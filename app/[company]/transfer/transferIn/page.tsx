"use client"

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Loader2, Package, Search, Camera, ArrowLeft, ArrowRight, Inbox,
  CheckCircle, ClipboardCheck, CheckCheck, FileText,
  AlertTriangle, X, Building2, Printer, ChevronDown, Pencil
} from "lucide-react"
import { toast } from "sonner"
import { InterunitApiService } from "@/lib/interunitApiService"
import { normalizeWarehouseName, isColdWarehouse } from "@/lib/constants/warehouses"
import { useAuthStore } from "@/lib/stores/auth"

import QRCode from "qrcode"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import type { Company } from "@/types/auth"
import { type LotRange } from "@/components/modules/inward/LotRangeDedicator"

interface TransferInPageProps {
  params: {
    company: Company
  }
}

export default function TransferInPage({ params }: TransferInPageProps) {
  const { company } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuthStore()

  const [transferNumber, setTransferNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [transferData, setTransferData] = useState<any>(null)
  const [boxesMatchMap, setBoxesMatchMap] = useState<Record<number, boolean>>({})
  const [linesMatchMap, setLinesMatchMap] = useState<Record<number, boolean>>({})
  const [linesIssueMap, setLinesIssueMap] = useState<Record<number, { remarks: string; net_weight?: string; total_weight?: string; case_pack?: string }>>({})
  const [issueOpenIndex, setIssueOpenIndex] = useState<number | null>(null)
  const [issueForm, setIssueForm] = useState({ remarks: "", net_weight: "", total_weight: "", case_pack: "" })
  const [applyToAllIssue, setApplyToAllIssue] = useState(false)
  const [boxCondition, setBoxCondition] = useState("Good")
  const [conditionRemarks, setConditionRemarks] = useState("")
  const [showAckScanner, setShowAckScanner] = useState(false)
  const [scanResult, setScanResult] = useState<{ type: "match" | "no-match" | "already" | "error"; message: string } | null>(null)

  // ── Pending transfer-in state (real-time acknowledge) ──
  const [pendingHeaderId, setPendingHeaderId] = useState<number | null>(null)
  const [reopening, setReopening] = useState(false)
  // Step 4 — close-with-shortage (partial receipt that won't complete)
  const [shortageDialogOpen, setShortageDialogOpen] = useState(false)
  const [shortageReason, setShortageReason] = useState("")
  const [closingShortage, setClosingShortage] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pendingGrnNumber, setPendingGrnNumber] = useState<string>("")
  const [inwardTransactionNo, setInwardTransactionNo] = useState<string | null>(null)
  const [generatingQRs, setGeneratingQRs] = useState(false)
  // keyed by line_index — populated after QR generation
  const [generatedBoxIds, setGeneratedBoxIds] = useState<Record<number, string>>({})
  // per-article box range reprint state
  const [articleRangeOpen, setArticleRangeOpen] = useState<Record<string, boolean>>({})
  const [articleRangeFrom, setArticleRangeFrom] = useState<Record<string, number>>({})
  const [articleRangeTo, setArticleRangeTo] = useState<Record<string, number>>({})

  // ── Editable line weights (keyed by line index) ──
  const [lineWeights, setLineWeights] = useState<Record<number, { net_weight: string; total_weight: string }>>({})

  // ── Scanned QR data per line index — used to save & display the actual scanned trans/box IDs
  //    when the line<->box mapping in lineBoxDataMap is incomplete (e.g. mismatched line/box counts).
  const [scannedLineData, setScannedLineData] = useState<Record<number, { box_id: string; transaction_no: string }>>({})

  // ── STBR reconciliation log ───────────────────────────────────────────────
  // Captures what the backend returned after each acknowledge call so the UI
  // can show "Originally: X → Scanned: Y" tooltips and a finalize summary.
  //   boxReconciliationMap — keyed by transfer_out_box id (boxes flow)
  //   lineReconciliationMap — keyed by line index (cold-storage / line flow)
  type BoxReconciliation = {
    status: string
    original_box_id?: string | null
    actual_box_id?: string
    propagated_count?: number
    siblings?: Array<{ old: string; new: string }>
  }
  const [boxReconciliationMap, setBoxReconciliationMap] = useState<Record<number, BoxReconciliation>>({})
  const [lineReconciliationMap, setLineReconciliationMap] = useState<Record<number, BoxReconciliation>>({})

  const updateLineWeight = (index: number, field: "net_weight" | "total_weight", value: string) => {
    setLineWeights(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }))
  }

  // Lot Dedicator: assign a lot number to a range of box numbers. The override
  // takes precedence over the per-item cold lot at the per-box acknowledge sites.
  const [boxLotRanges, setBoxLotRanges] = useState<LotRange[]>([])
  const dedicatedLot = (b: any): string | null => {
    const n = Number(b?.box_number)
    if (!Number.isFinite(n)) return null
    const r = boxLotRanges.find((x) => n >= x.from && n <= x.to)
    return r ? r.lot : null
  }

  // ── Authorized users for acknowledge / print QR / issue actions ──
  const AUTHORIZED_ACKNOWLEDGE_USERS = ["yash@candorfoods.in", "b.hrithik@candorfoods.in", "sunil.jasoria@candorfoods.in"]
  const isAuthorizedUser = AUTHORIZED_ACKNOWLEDGE_USERS.includes(user?.email?.toLowerCase() || "")
  // Only this user may re-open a Received transfer-in back to Pending (to correct
  // a lot number / raise a box issue). Enforced again server-side.
  const canReopenReceived = (user?.email?.toLowerCase() || "") === "b.hrithik@candorfoods.in"

  // ── Cold storage check — used to drive cold-FROM display logic (cold→warehouse IN) ──
  const COLD_STORAGE_WAREHOUSES = ["Cold Storage", "Rishi", "Savla D-39", "Savla D-514", "Supreme"]
  const fromWarehouse = transferData?.from_warehouse || transferData?.from_site || ""
  const toWarehouse = transferData?.to_warehouse || transferData?.to_site || ""
  const isColdStorageFrom = COLD_STORAGE_WAREHOUSES.some(w => w.toLowerCase() === fromWarehouse.toLowerCase())

  // ── Derived state ──
  const boxes = transferData?.boxes || []
  const rawLines = transferData?.lines || []

  // `LINE-{line_id}-{n}` is a backend tracking placeholder written by
  // pending_stock_tools.park_in_pending for box-less line transfers. It's not
  // a real box_id — surfacing it here would (a) disable Generate QR's button
  // and (b) print/QR-encode a sentinel value. Treat as "no id yet."
  const isSyntheticLineBoxId = (id: any) =>
    typeof id === "string" && id.startsWith("LINE-")

  // For cold-storage transfers, render Article Entries directly from the boxes table —
  // each box already has box_id + transaction_no populated, while transfer_lines does not.
  // Memoized so its reference is stable across renders (prevents downstream effect loops).
  const linesFromBoxes = useMemo(() => {
    const _boxes = transferData?.boxes || []
    if (!isColdStorageFrom || _boxes.length === 0) return null
    return _boxes.map((b: any) => {
      const synthetic = isSyntheticLineBoxId(b.box_id)
      return {
        id: b.id,
        _source: "box",
        _box_origin: b,
        item_description: b.article || "",
        item_desc_raw: b.article || "",
        box_id: synthetic ? "" : (b.box_id || ""),
        box_number: b.box_number,
        transaction_no: synthetic ? "" : (b.transaction_no || ""),
        lot_number: b.lot_number || "",
        batch_number: b.batch_number || "",
        net_weight: b.net_weight,
        total_weight: b.gross_weight,
        quantity: "1",
        qty: 1,
        uom: "BOX",
        pack_size: "1",
        unit_pack_size: "1",
      }
    })
  }, [transferData, isColdStorageFrom])

  // True whenever scanned boxes exist on a non-cold transfer. Every entry (scanned OR
  // manually typed) is shown as an Article Entry line and acknowledged via the line flow —
  // scanned boxes are NEVER split into a separate section (Article Entries is the single
  // source of truth, per product decision). Pure-scanned and mixed scan+manual both take
  // this path; only truly box-less line transfers (boxes.length === 0) fall through to the
  // line-only branch. Previously this required boxes>=lines, so MIXED transfers filtered the
  // scanned lines out and — with no boxes section — they vanished from the receive screen.
  const allLinesCoveredByBoxes = boxes.length > 0
  // Memoized so `lines` ref is stable — downstream effects with `lines` in deps must not re-fire every render.
  const lines = useMemo(() => {
    if (linesFromBoxes) return linesFromBoxes
    if (allLinesCoveredByBoxes) return rawLines
    const _boxLineIds = new Set((transferData?.boxes || []).map((b: any) => b.transfer_line_id).filter(Boolean))
    return rawLines.filter((l: any) => !_boxLineIds.has(l.id))
  }, [transferData, linesFromBoxes, allLinesCoveredByBoxes])
  const totalBoxes = boxes.length
  const totalLines = lines.length
  const uniqueArticleCount = useMemo(() => {
    const set = new Set<string>()
    lines.forEach((l: any) => {
      const name = (l.item_desc_raw || l.item_description || "").trim()
      if (name) set.add(name)
    })
    return set.size
  }, [lines])
  const hasBatchData = lines.some((l: any) => l.batch_number)

  // Group line indices by article name (for per-article box range reprint)
  const articleLineGroups = useMemo(() => {
    const groups: Record<string, number[]> = {}
    lines.forEach((line: any, i: number) => {
      const name = line.item_desc_raw || line.item_description || `Article ${i + 1}`
      if (!groups[name]) groups[name] = []
      groups[name].push(i)
    })
    return groups
  }, [lines])
  // When lines come from boxes (cold storage) OR boxes cover all lines, only Article Entries
  // is shown — total count should only include lines, not boxes-section duplicates.
  const linesAreBoxes = linesFromBoxes !== null
  const totalItems = (linesAreBoxes || allLinesCoveredByBoxes) ? totalLines : totalBoxes + totalLines
  const matchedBoxes = boxes.filter((b: any) => boxesMatchMap[b.id]).length
  const matchedLines = lines.filter((_: any, i: number) => linesMatchMap[i]).length
  const issuedLines = lines.filter((_: any, i: number) => linesIssueMap[i]).length
  const resolvedLines = matchedLines + issuedLines
  const totalMatched = (linesAreBoxes || allLinesCoveredByBoxes) ? resolvedLines : matchedBoxes + resolvedLines
  const allMatched = totalItems > 0 && totalMatched === totalItems

  // ── Map each transfer LINE id → its scanned box's { box_id, transaction_no } ──
  //
  // The outward side keys interunit_transfer_boxes.transfer_line_id by ARTICLE (every box
  // of the same article points at one line id), so that field can't distinguish multiple
  // entries of the same article. Instead, assign boxes to lines greedily by (article, lot):
  // the i-th line of a given (article, lot) gets the i-th scanned box of that (article, lot).
  // This gives each scanned Article Entry its own box_id/transaction_no in mixed scan+manual
  // transfers, while box-less (manual) lines simply get no mapping (they need "Generate QR").
  const lineBoxDataMap = useMemo(() => {
    const _boxes = (transferData?.boxes as any[]) || []
    const _lines = transferData?.lines || []
    if (_boxes.length === 0) return {}
    const keyOf = (article: any, lot: any) =>
      `${String(article || "").trim().toUpperCase()}|${String(lot || "").trim()}`
    const boxesByKey: Record<string, any[]> = {}
    _boxes.forEach((b: any) => {
      const k = keyOf(b.article, b.lot_number)
      ;(boxesByKey[k] ||= []).push(b)
    })
    const cursor: Record<string, number> = {}
    const map: Record<number, { box_id: string; transaction_no: string }> = {}
    _lines.forEach((l: any) => {
      const k = keyOf(l.item_desc_raw || l.item_description, l.lot_number)
      const arr = boxesByKey[k] || []
      const i = cursor[k] || 0
      if (i < arr.length) {
        cursor[k] = i + 1
        const b = arr[i]
        const synthetic = isSyntheticLineBoxId(b.box_id)
        map[l.id] = {
          box_id: synthetic ? "" : (b.box_id || ""),
          transaction_no: synthetic ? "" : (b.transaction_no || ""),
        }
      }
    })
    return map
  }, [transferData])

  // ── Group boxes by article ──
  const groupedBoxes = useMemo(() => {
    if (!transferData?.boxes) return {}
    const groups: Record<string, any[]> = {}
    transferData.boxes.forEach((b: any) => {
      const article = b.article || "Unknown Article"
      if (!groups[article]) groups[article] = []
      groups[article].push(b)
    })
    return groups
  }, [transferData])

  // Load transfer details by transfer number
  const loadTransferDetails = async (transferNo: string) => {
    if (!transferNo.trim()) {
      toast.error("Please enter a transfer number")
      return
    }

    setLoading(true)
    try {
      const response = await InterunitApiService.getTransferByNumber(company, transferNo)

      // Destination-class gate at LOAD time. If the destination is a cold
      // warehouse (Savla / Rishi / Supreme / Cold Storage), refuse to populate
      // the form — cold-destination receipts must go through
      // /cold-transfer/coldtransfer-in, regardless of whether the source is
      // a warehouse or cold storage.
      const _toWh = response.to_warehouse || response.to_site || ""
      // Canonical cold-destination check (normalize first) so aliases like "Supreme Cold",
      // "savla bond", "rishi cold storage" also route to the cold flow — not just the exact
      // canonical spellings. Cold-destination receipts MUST go through coldtransfer-in.
      const _isColdDest = isColdWarehouse(normalizeWarehouseName(_toWh))
      if (_isColdDest) {
        toast.error(
          `Destination "${_toWh || "(unknown)"}" is a cold warehouse. ` +
          `Use the Cold Transfer-In page (/cold-transfer/coldtransfer-in) for this receipt.`
        )
        setTransferData(null)
        return
      }

      // ── Comprehensive search result logging ──
      console.group(`🔍 [TRANSFER-IN] Loaded: ${response.challan_no || response.transfer_no || transferNo}`)

      console.log('📋 HEADER', {
        id: response.id,
        transfer_no: response.transfer_no,
        challan_no: response.challan_no,
        status: response.status,
        from_warehouse: response.from_warehouse || response.from_site,
        to_warehouse: response.to_warehouse || response.to_site,
        from_site_code: response.from_site_code,
        to_site_code: response.to_site_code,
        transfer_date: response.transfer_date,
        created_at: response.created_at,
        created_by: response.created_by,
        remarks: response.remarks,
        vehicle_no: response.vehicle_no,
        driver_name: response.driver_name,
      })

      console.log(`📦 BOXES (${response.boxes?.length || 0} total)`, response.boxes || [])
      if (response.boxes?.length) {
        console.table(response.boxes.map((b: any) => ({
          id: b.id,
          box_id: b.box_id,
          box_number: b.box_number,
          transaction_no: b.transaction_no,
          article: b.article,
          lot_number: b.lot_number,
          batch_number: b.batch_number,
          net_weight: b.net_weight,
          gross_weight: b.gross_weight,
          transfer_line_id: b.transfer_line_id,
        })))
      }

      console.log(`📄 LINES (${response.lines?.length || 0} total)`, response.lines || [])
      if (response.lines?.length) {
        console.table(response.lines.map((l: any) => ({
          id: l.id,
          item_description: l.item_desc_raw || l.item_description,
          qty: l.qty ?? l.quantity,
          uom: l.uom,
          net_weight: l.net_weight,
          total_weight: l.total_weight,
          lot_number: l.lot_number,
          batch_number: l.batch_number,
          pack_size: l.pack_size,
          item_category: l.item_category,
          sub_category: l.sub_category,
        })))
      }

      const _isColdFrom = COLD_STORAGE_WAREHOUSES.some(w =>
        w.toLowerCase() === (response.from_warehouse || response.from_site || "").toLowerCase()
      )
      console.log('🏢 WAREHOUSE FLAGS', {
        from_warehouse: response.from_warehouse || response.from_site,
        to_warehouse: response.to_warehouse || response.to_site,
        isColdStorageFrom: _isColdFrom,
        isColdStorageTo: COLD_STORAGE_WAREHOUSES.some(w =>
          w.toLowerCase() === (response.to_warehouse || response.to_site || "").toLowerCase()
        ),
      })

      console.groupEnd()

      setTransferData(response)
      setInwardTransactionNo(null)
      setGeneratedBoxIds({})

      // Init box match map
      const boxMap: Record<number, boolean> = {}
      ;(response.boxes || []).forEach((b: any) => { boxMap[b.id] = false })
      setBoxesMatchMap(boxMap)

      // Init line match map
      const lineMap: Record<number, boolean> = {}
      ;(response.lines || []).forEach((_: any, i: number) => { lineMap[i] = false })
      setLinesMatchMap(lineMap)

      // Init editable line weights
      // When boxes cover all lines (1:1), use per-box weights instead of line totals
      const respLines = response.lines || []
      const respBoxes = response.boxes || []
      const boxesCoverLines = respBoxes.length > 0 && respBoxes.length >= respLines.length
      const weightsMap: Record<number, { net_weight: string; total_weight: string }> = {}
      respLines.forEach((line: any, i: number) => {
        const boxWt = boxesCoverLines && respBoxes[i]
          ? { net: respBoxes[i].net_weight, gross: respBoxes[i].gross_weight }
          : null
        weightsMap[i] = {
          net_weight: boxWt ? String(boxWt.net) : (line.net_weight ? String(line.net_weight) : ""),
          total_weight: boxWt ? String(boxWt.gross || boxWt.net) : (line.total_weight ? String(line.total_weight) : ""),
        }
      })
      setLineWeights(weightsMap)

      const boxCount = (response.boxes || []).length
      const lineCount = (response.lines || []).length
      toast.success(`Transfer ${response.transfer_no || response.challan_no} loaded with ${boxCount} boxes and ${lineCount} article lines`)

      // Check for existing pending transfer-in (resume flow)
      try {
        const pendingResult = await InterunitApiService.getPendingByTransferOut(response.id)
        if (pendingResult.exists && pendingResult.header) {
          setPendingHeaderId(pendingResult.header.id)
          setPendingGrnNumber(pendingResult.header.grn_number)
          if (pendingResult.header.inward_transaction_no) {
            setInwardTransactionNo(pendingResult.header.inward_transaction_no)
          }

          // Restore acknowledged/issue state from saved boxes.
          //
          // IMPORTANT: a saved box's `line_index` is the array POSITION at the time
          // it was originally acknowledged — that position is NOT stable across a
          // reopen/resume, so restoring by it lands flags on the WRONG box. For
          // cold/box-derived transfers the displayed "lines" ARE response.boxes (same
          // order), so remap each saved box to its CURRENT index by the stable
          // identity (box_id + transaction_no). Falls back to positional line_index
          // only for true line-based transfers with no box_id.
          const savedBoxes = pendingResult.header.boxes || []
          const restoredLineMap: Record<number, boolean> = {}
          const restoredIssueMap: Record<number, { remarks: string; net_weight?: string; total_weight?: string; case_pack?: string }> = {}
          const restoredBoxMap: Record<number, boolean> = {}

          const restoredWeights: Record<number, { net_weight: string; total_weight: string }> = {}

          const _coldLines = (_isColdFrom && (response.boxes || []).length > 0) ? (response.boxes || []) : null
          const idxByBoxKey: Record<string, number> = {}
          if (_coldLines) {
            _coldLines.forEach((b: any, i: number) => {
              if (b.box_id) idxByBoxKey[`${b.box_id}|${b.transaction_no || ""}`] = i
            })
          }

          savedBoxes.forEach((sb: any) => {
            let idx: number | undefined = undefined
            if (_coldLines && sb.box_id) {
              idx = idxByBoxKey[`${sb.box_id}|${sb.transaction_no || ""}`]
            }
            if ((idx === undefined || idx === null) && sb.line_index !== null && sb.line_index !== undefined) {
              idx = sb.line_index
            }

            if (idx !== undefined && idx !== null) {
              if (sb.is_matched) {
                restoredLineMap[idx] = true
              } else if (sb.issue) {
                const issueData = typeof sb.issue === "string" ? JSON.parse(sb.issue) : sb.issue
                restoredIssueMap[idx] = {
                  remarks: issueData.remarks || "",
                  net_weight: issueData.net_weight || undefined,
                  total_weight: issueData.total_weight || undefined,
                  case_pack: issueData.case_pack || undefined,
                }
              }
              // Restore weights from acknowledged box data (prevents reversion)
              if (sb.net_weight != null || sb.gross_weight != null) {
                restoredWeights[idx] = {
                  net_weight: sb.net_weight != null ? String(sb.net_weight) : (weightsMap[idx]?.net_weight || ""),
                  total_weight: sb.gross_weight != null ? String(sb.gross_weight) : (weightsMap[idx]?.total_weight || ""),
                }
              }
            } else if (sb.transfer_out_box_id) {
              restoredBoxMap[sb.transfer_out_box_id] = true
            }
          })

          if (Object.keys(restoredLineMap).length > 0) setLinesMatchMap(restoredLineMap)
          if (Object.keys(restoredIssueMap).length > 0) setLinesIssueMap(restoredIssueMap)
          if (Object.keys(restoredBoxMap).length > 0) {
            setBoxesMatchMap(prev => ({ ...prev, ...restoredBoxMap }))
          }
          // Restore line weights from acknowledged data so they don't revert
          if (Object.keys(restoredWeights).length > 0) {
            setLineWeights(prev => ({ ...prev, ...restoredWeights }))
          }

          toast.success(`Resuming pending GRN ${pendingResult.header.grn_number}`)
        }
      } catch (e) {
        console.warn("Could not check for pending transfer-in:", e)
      }
    } catch (error: any) {
      console.error("Failed to load transfer:", error)
      toast.error(error.message || "Failed to load transfer details")
      setTransferData(null)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => loadTransferDetails(transferNumber)

  // Re-open a Received transfer-in: reverses the receipt's stock movement
  // (server-side, gated to b.hrithik), then reloads so the user can un-acknowledge
  // a box, correct its lot / raise an issue, and Confirm Receipt again.
  const handleReopenReceipt = async () => {
    if (!transferData?.id) return
    if (typeof window !== "undefined" && !window.confirm(
      "Re-open this received transfer-in?\n\nStock will be moved back to in-transit so you can un-acknowledge boxes, correct lot numbers / raise issues, then confirm receipt again."
    )) return
    setReopening(true)
    try {
      const result = await InterunitApiService.reopenTransferIn(transferData.id, user?.email || "")
      toast.success("Receipt re-opened — un-acknowledge a box to change its lot or raise an issue, then Confirm Receipt again.")
      const transferNo = transferData.challan_no || transferData.transfer_no || transferNumber
      await loadTransferDetails(transferNo)
      // Adopt the existing (re-opened) Pending transfer-in header so the screen
      // edits it in place instead of creating a duplicate header.
      if (result?.id) { setPendingHeaderId(result.id); setPendingGrnNumber(result.grn_number || null) }
    } catch (err: any) {
      toast.error(err?.message || "Failed to re-open receipt")
    } finally {
      setReopening(false)
    }
  }

  // ── Resume from URL query param ──
  const resumeTransferNo = searchParams.get("resume")
  const resumeHandledRef = useRef<string | null>(null)
  useEffect(() => {
    if (resumeTransferNo && resumeHandledRef.current !== resumeTransferNo) {
      resumeHandledRef.current = resumeTransferNo
      setTransferNumber(resumeTransferNo)
      setTransferData(null) // Clear stale data so fresh load happens
      setPendingHeaderId(null)
      setPendingGrnNumber("")
      loadTransferDetails(resumeTransferNo)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeTransferNo])

  // ── Helper: ensure pending header exists (creates on first acknowledge) ──
  const pendingHeaderPromiseRef = useRef<Promise<number | null> | null>(null)

  const ensurePendingHeader = async (): Promise<number | null> => {
    if (pendingHeaderId) return pendingHeaderId
    if (!transferData) return null

    // If a creation is already in-flight, wait for it instead of creating a duplicate
    if (pendingHeaderPromiseRef.current) return pendingHeaderPromiseRef.current

    const promise = (async () => {
      try {
        const now = new Date()
        const grnNumber = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
        const header = await InterunitApiService.createPendingTransferIn({
          transfer_out_id: transferData.id,
          grn_number: grnNumber,
          receiving_warehouse: transferData.to_warehouse || transferData.to_site_code || "UNKNOWN",
          received_by: user?.name || user?.email || "USER",
        })
        setPendingHeaderId(header.id)
        setPendingGrnNumber(header.grn_number || grnNumber)
        return header.id
      } catch (err: any) {
        toast.error(err.message || "Failed to create pending transfer")
        return null
      } finally {
        pendingHeaderPromiseRef.current = null
      }
    })()

    pendingHeaderPromiseRef.current = promise
    return promise
  }

  // ── Box handlers ──
  // scannedActualId — the actual QR-scanned box_id (used for STBR). When the
  // user clicks "Acknowledge" without scanning, the placeholder IMS box_id is
  // sent and STBR finds nothing to reconcile (status: 'noop' / 'matched').
  const handleAcknowledgeBox = async (boxId: number, scannedActualId?: string) => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const box = boxes.find((b: any) => b.id === boxId)
    if (!box) return

    const sentBoxId = scannedActualId
      ?? String(box.box_id || box.box_number || box.id || "")
    try {
      const resp = await InterunitApiService.acknowledgeBox(headerId, {
        box_id: sentBoxId,
        transfer_out_box_id: box.id,
        article: box.article ? String(box.article) : null,
        batch_number: box.batch_number ? String(box.batch_number) : null,
        lot_number: dedicatedLot(box) || (box.lot_number ? String(box.lot_number) : null),
        transaction_no: box.transaction_no ? String(box.transaction_no) : null,
        net_weight: box.net_weight ? Number(box.net_weight) : null,
        gross_weight: box.gross_weight ? Number(box.gross_weight) : null,
        is_matched: true,
        scan_source: scannedActualId ? "qr_scan" : "manual",
        scanned_by: user?.email || null,
      })
      setBoxesMatchMap((prev) => ({ ...prev, [boxId]: true }))

      const rec = resp?.reconciliation
      if (rec && rec.status && rec.status !== "noop") {
        setBoxReconciliationMap((prev) => ({
          ...prev,
          [boxId]: {
            status: String(rec.status),
            original_box_id: rec.original_box_id,
            actual_box_id: sentBoxId,
            propagated_count: rec.propagated_count || 0,
            siblings: rec.siblings || [],
          },
        }))
        // Toast variant reflects reconciliation outcome
        if (rec.status === "overridden" || rec.status === "overridden_no_source") {
          const orig = rec.original_box_id || "—"
          const extra = rec.propagated_count
            ? ` (+${rec.propagated_count} siblings auto-mapped)`
            : ""
          toast.success(
            `Reconciled: ${orig} → ${sentBoxId}${extra}`,
            { duration: 4500 } as any,
          )
        } else if (rec.status === "propagated") {
          toast.success(
            `Series remap: ${rec.original_box_id} → ${sentBoxId} (+${rec.propagated_count} siblings)`,
            { duration: 5500 } as any,
          )
        } else if (rec.status === "matched") {
          toast.success(`Box #${boxId} acknowledged`)
        } else {
          toast.success(`Box #${boxId} acknowledged (${rec.status})`)
        }
      } else {
        toast.success(`Box #${boxId} acknowledged`)
      }
    } catch (err: any) {
      // Map STBR-specific HTTP errors to clearer toasts
      const status = err?.response?.status
      if (status === 409) {
        toast.error(`Duplicate scan — this box was already received in another transfer.`)
      } else if (status === 422) {
        const detail = err?.response?.data?.detail || err?.message || "no matching slot"
        toast.error(`Reconciliation conflict: ${detail}`)
      } else {
        toast.error(err.message || "Failed to acknowledge box")
      }
    }
  }

  const handleUnacknowledgeBox = async (boxId: number) => {
    if (!pendingHeaderId) {
      // No pending header means nothing was saved to DB yet — just clear local state
      setBoxesMatchMap((prev) => { const next = { ...prev }; delete next[boxId]; return next })
      toast.success(`Box #${boxId} unacknowledged`)
      return
    }
    const box = boxes.find((b: any) => b.id === boxId)
    if (!box) return
    const bId = String(box.box_id || box.box_number || box.id || "")

    try {
      await InterunitApiService.unacknowledgeBox(pendingHeaderId, bId)
      setBoxesMatchMap((prev) => {
        const next = { ...prev }
        delete next[boxId]
        return next
      })
      toast.success(`Box #${boxId} unacknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to unacknowledge box")
    }
  }

  const handleAcknowledgeArticleBoxes = async (articleName: string) => {
    const articleBoxes = groupedBoxes[articleName] || []
    if (articleBoxes.length === 0) return

    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const batchItems = articleBoxes
      .filter((b: any) => !boxesMatchMap[b.id])
      .map((b: any) => ({
        box_id: String(b.box_id || b.box_number || b.id || ""),
        transfer_out_box_id: b.id,
        article: b.article ? String(b.article) : null,
        batch_number: b.batch_number ? String(b.batch_number) : null,
        lot_number: dedicatedLot(b) || (b.lot_number ? String(b.lot_number) : null),
        transaction_no: b.transaction_no ? String(b.transaction_no) : null,
        net_weight: b.net_weight ? Number(b.net_weight) : null,
        gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
        is_matched: true,
      }))

    if (batchItems.length === 0) return

    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchItems)
      const newMap = { ...boxesMatchMap }
      articleBoxes.forEach((b: any) => { newMap[b.id] = true })
      setBoxesMatchMap(newMap)
      toast.success(`All ${articleBoxes.length} boxes for "${articleName}" acknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge boxes")
    }
  }

  // ── Line handlers ──
  const handleAcknowledgeLine = async (lineIndex: number, scannedRef?: { box_id?: string; transaction_no?: string }) => {
    const line = lines[lineIndex]
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    try {
      const w = lineWeights[lineIndex] || {}
      const boxRef = lineBoxDataMap[line.id] || {}
      const scanned = scannedRef || scannedLineData[lineIndex] || {}
      const articleName = line.item_desc_raw || line.item_description || ""
      const sentBoxId = scanned.box_id || generatedBoxIds[lineIndex] || line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`
      const isQrScan = !!scanned.box_id
      const resp = await InterunitApiService.acknowledgeBox(headerId, {
        box_id: sentBoxId,
        article: articleName,
        batch_number: line.batch_number || null,
        lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
        transaction_no: scanned.transaction_no || inwardTransactionNo || line.transaction_no || boxRef.transaction_no || null,
        net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
        gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
        is_matched: true,
        line_index: lineIndex,
        scan_source: isQrScan ? "qr_scan" : "manual",
        scanned_by: user?.email || null,
      })
      setLinesMatchMap((prev) => ({ ...prev, [lineIndex]: true }))

      const rec = resp?.reconciliation
      if (rec && rec.status && rec.status !== "noop") {
        setLineReconciliationMap((prev) => ({
          ...prev,
          [lineIndex]: {
            status: String(rec.status),
            original_box_id: rec.original_box_id,
            actual_box_id: sentBoxId,
            propagated_count: rec.propagated_count || 0,
            siblings: rec.siblings || [],
          },
        }))
        if (rec.status === "overridden" || rec.status === "overridden_no_source") {
          const orig = rec.original_box_id || "—"
          const extra = rec.propagated_count
            ? ` (+${rec.propagated_count} siblings auto-mapped)`
            : ""
          toast.success(`Reconciled: ${orig} → ${sentBoxId}${extra}`, { duration: 4500 } as any)
        } else if (rec.status === "propagated") {
          toast.success(
            `Series remap: ${rec.original_box_id} → ${sentBoxId} (+${rec.propagated_count} siblings)`,
            { duration: 5500 } as any,
          )
        } else {
          toast.success(`${articleName || "Line " + (lineIndex + 1)} acknowledged`)
        }
      } else {
        toast.success(`${articleName || "Line " + (lineIndex + 1)} acknowledged`)
      }
    } catch (err: any) {
      const status = err?.response?.status
      if (status === 409) {
        toast.error(`Duplicate scan — this box was already received in another transfer.`)
      } else if (status === 422) {
        const detail = err?.response?.data?.detail || err?.message || "no matching slot"
        toast.error(`Reconciliation conflict: ${detail}`)
      } else {
        toast.error(err.message || "Failed to save acknowledgment")
      }
    }
  }

  const handleUnacknowledgeLine = async (lineIndex: number) => {
    if (!pendingHeaderId) {
      // No pending header means nothing was saved to DB yet — just clear local state
      setLinesMatchMap((prev) => { const next = { ...prev }; delete next[lineIndex]; return next })
      const l = lines[lineIndex]
      toast.success(`${l?.item_desc_raw || l?.item_description || "Line " + (lineIndex + 1)} unacknowledged`)
      return
    }
    const line = lines[lineIndex]
    const boxRef = lineBoxDataMap[line.id] || {}
    const boxId = generatedBoxIds[lineIndex] || line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`

    try {
      await InterunitApiService.unacknowledgeBox(pendingHeaderId, boxId)
      setLinesMatchMap((prev) => {
        const next = { ...prev }
        delete next[lineIndex]
        return next
      })
      toast.success(`${line?.item_desc_raw || line?.item_description || "Line " + (lineIndex + 1)} unacknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to remove acknowledgment")
    }
  }

  // ── Issue handlers ──
  const handleOpenIssue = (lineIndex: number) => {
    const line = lines[lineIndex]
    const w = lineWeights[lineIndex] || {}
    setIssueOpenIndex(lineIndex)
    setIssueForm({
      remarks: "",
      net_weight: String(w.net_weight ?? line.net_weight ?? ""),
      total_weight: String(w.total_weight ?? line.total_weight ?? ""),
      case_pack: String(line.pack_size || ""),
    })
  }

  const handleSubmitIssue = async (lineIndex: number) => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const line = lines[lineIndex]
    const issueNetWt = issueForm.net_weight.trim()
    const issueTotalWt = issueForm.total_weight.trim()
    const issueCasePack = issueForm.case_pack.trim()
    const issueRemarks = issueForm.remarks.trim()

    const issueData = {
      remarks: issueRemarks,
      net_weight: issueNetWt || undefined,
      total_weight: issueTotalWt || undefined,
      case_pack: issueCasePack || undefined,
    }

    // Determine which line indices to apply to (this one + all matching pending if checkbox on)
    const itemName = line.item_desc_raw || line.item_description || ""
    const targetIndices: number[] = [lineIndex]
    if (applyToAllIssue) {
      lines.forEach((l: any, i: number) => {
        if (i === lineIndex) return
        const lName = l.item_desc_raw || l.item_description || ""
        if (lName === itemName && !linesMatchMap[i] && !linesIssueMap[i]) {
          targetIndices.push(i)
        }
      })
    }

    try {
      const newIssueMap: Record<number, typeof issueData> = {}
      const newWeightsMap: Record<number, { net_weight: string; total_weight: string }> = {}

      for (const idx of targetIndices) {
        const targetLine = lines[idx]
        const targetBoxRef = lineBoxDataMap[targetLine.id] || {}
        const targetArticle = targetLine.item_desc_raw || targetLine.item_description || ""
        await InterunitApiService.acknowledgeBox(headerId, {
          box_id: generatedBoxIds[idx] || targetLine.box_id || targetBoxRef.box_id || `ART-${idx + 1}`,
          article: targetArticle,
          batch_number: targetLine.batch_number || null,
          lot_number: dedicatedLot(targetLine?._box_origin) || targetLine.lot_number || null,
          transaction_no: targetBoxRef.transaction_no || targetLine.transaction_no || inwardTransactionNo || null,
          net_weight: issueNetWt ? Number(issueNetWt) : (targetLine.net_weight ? Number(targetLine.net_weight) : null),
          gross_weight: issueTotalWt ? Number(issueTotalWt) : (targetLine.total_weight ? Number(targetLine.total_weight) : null),
          is_matched: false,
          issue: issueData,
          line_index: idx,
        })
        newIssueMap[idx] = issueData
        if (issueNetWt || issueTotalWt) {
          newWeightsMap[idx] = {
            net_weight: issueNetWt || "",
            total_weight: issueTotalWt || "",
          }
        }
      }

      setLinesIssueMap(prev => ({ ...prev, ...newIssueMap }))
      setLinesMatchMap(prev => {
        const next = { ...prev }
        targetIndices.forEach(i => delete next[i])
        return next
      })
      if (Object.keys(newWeightsMap).length > 0) {
        setLineWeights(prev => ({ ...prev, ...newWeightsMap }))
      }
      setIssueOpenIndex(null)
      setIssueForm({ remarks: "", net_weight: "", total_weight: "", case_pack: "" })
      setApplyToAllIssue(false)
      const count = targetIndices.length
      toast.success(count > 1 ? `Discrepancy noted for ${count} boxes of ${itemName}` : `Discrepancy noted for ${itemName}`)

      // Auto-print issue QR for cold storage transfers
      if (isColdStorageFrom) {
        for (const idx of targetIndices) {
          await handlePrintQR(idx, { skipAcknowledge: true, issueOverride: issueData })
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to save issue")
    }
  }

  const handleCancelIssue = () => {
    setIssueOpenIndex(null)
    setIssueForm({ remarks: "", net_weight: "", total_weight: "", case_pack: "" })
    setApplyToAllIssue(false)
  }

  // ── Acknowledge all ──
  const handleAcknowledgeAll = async () => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    // Build batch of ALL unacknowledged lines + boxes
    const batchItems: any[] = []

    lines.forEach((line: any, i: number) => {
      if (!linesMatchMap[i] && !linesIssueMap[i]) {
        const w = lineWeights[i] || {}
        const boxRef = lineBoxDataMap[line.id] || {}
        const articleName = line.item_desc_raw || line.item_description || ""
        batchItems.push({
          box_id: generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`,
          article: articleName,
          batch_number: line.batch_number || null,
          lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
          transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
          net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
          gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
          is_matched: true,
          line_index: i,
        })
      }
    })

    // In cold-storage mode (linesAreBoxes) OR when boxes cover all lines, each
    // displayed "line" IS one of the boxes — iterating boxes here would push the
    // same physical unit twice, producing duplicate rows in transfer_in_boxes.
    if (!linesAreBoxes && !allLinesCoveredByBoxes) {
      boxes.forEach((b: any) => {
        if (!boxesMatchMap[b.id]) {
          batchItems.push({
            box_id: String(b.box_id || b.box_number || b.id || ""),
            transfer_out_box_id: b.id,
            article: b.article ? String(b.article) : null,
            batch_number: b.batch_number ? String(b.batch_number) : null,
            lot_number: dedicatedLot(b) || (b.lot_number ? String(b.lot_number) : null),
            transaction_no: b.transaction_no ? String(b.transaction_no) : null,
            net_weight: b.net_weight ? Number(b.net_weight) : null,
            gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
            is_matched: true,
          })
        }
      })
    }

    if (batchItems.length === 0) {
      toast.success("All items already acknowledged")
      return
    }

    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchItems)

      // Same guard: don't mark boxes "matched" when lines already represent them,
      // otherwise the finalize loop pushes duplicates.
      if (!linesAreBoxes && !allLinesCoveredByBoxes) {
        const newBoxMap = { ...boxesMatchMap }
        boxes.forEach((b: any) => { newBoxMap[b.id] = true })
        setBoxesMatchMap(newBoxMap)
      }

      const newLineMap = { ...linesMatchMap }
      lines.forEach((_: any, i: number) => {
        if (!linesIssueMap[i]) newLineMap[i] = true
      })
      setLinesMatchMap(newLineMap)

      toast.success(`${batchItems.length} items acknowledged successfully`)
    } catch (err: any) {
      toast.error(err.message || "Failed to batch acknowledge")
    }
  }

  // ── Acknowledge all lines (skip already issued) ──
  const handleAcknowledgeAllLines = async () => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const batchBoxes: any[] = []
    lines.forEach((line: any, i: number) => {
      if (!linesMatchMap[i] && !linesIssueMap[i]) {
        const w = lineWeights[i] || {}
        const boxRef = lineBoxDataMap[line.id] || {}
        const articleName = line.item_desc_raw || line.item_description || ""
        batchBoxes.push({
          box_id: generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`,
          article: articleName,
          batch_number: line.batch_number || null,
          lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
          transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
          net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
          gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
          is_matched: true,
          line_index: i,
        })
      }
    })

    if (batchBoxes.length === 0) {
      toast.success("All lines already acknowledged")
      return
    }

    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchBoxes)
      const newMap = { ...linesMatchMap }
      lines.forEach((_: any, i: number) => {
        if (!linesIssueMap[i]) newMap[i] = true
      })
      setLinesMatchMap(newMap)
      toast.success(`${batchBoxes.length} article lines acknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to batch acknowledge")
    }
  }

  // ── Acknowledge all boxes ──
  const handleAcknowledgeAllBoxes = async () => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const batchItems = boxes
      .filter((b: any) => !boxesMatchMap[b.id])
      .map((b: any) => ({
        box_id: String(b.box_id || b.box_number || b.id || ""),
        transfer_out_box_id: b.id,
        article: b.article ? String(b.article) : null,
        batch_number: b.batch_number ? String(b.batch_number) : null,
        lot_number: dedicatedLot(b) || (b.lot_number ? String(b.lot_number) : null),
        transaction_no: b.transaction_no ? String(b.transaction_no) : null,
        net_weight: b.net_weight ? Number(b.net_weight) : null,
        gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
        is_matched: true,
      }))

    if (batchItems.length === 0) {
      toast.success("All boxes already acknowledged")
      return
    }

    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchItems)
      const newMap = { ...boxesMatchMap }
      boxes.forEach((b: any) => { newMap[b.id] = true })
      setBoxesMatchMap(newMap)
      toast.success(`${batchItems.length} boxes acknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge boxes")
    }
  }

  const handleQRScanError = (error: string) => {
    console.error("QR Scan Error:", error)
    toast.error(error)
  }

  // ── Scan to Acknowledge handler ──
  // Matches scanned QR (box_id + transaction_no) against DB entries and auto-acknowledges
  const handleAckQRScan = async (decodedText: string) => {
    let scannedBoxId = ""
    let scannedTransactionNo = ""

    // Parse QR data — supports formats: {tx, bi}, {transaction_no, box_id}, {cn, ...}
    try {
      const qrData = JSON.parse(decodedText)
      scannedTransactionNo = String(qrData.tx || qrData.transaction_no || qrData.cn || "").trim()
      scannedBoxId = String(qrData.bi || qrData.box_id || qrData.boxId || "").trim()
    } catch {
      scannedBoxId = decodedText.trim()
    }

    if (!scannedBoxId && !scannedTransactionNo) {
      setScanResult({ type: "error", message: "Invalid QR — no box_id or transaction_no found" })
      return
    }

    // Match using transaction_no AND box_id from DB
    const isMatch = (bBoxId: string, bTxnNo: string) => {
      if (scannedBoxId && scannedTransactionNo) {
        return bBoxId === scannedBoxId && bTxnNo === scannedTransactionNo
      }
      if (scannedTransactionNo) return bTxnNo === scannedTransactionNo
      if (scannedBoxId) return bBoxId === scannedBoxId
      return false
    }

    // Match scanned QR against transfer boxes from DB (using box_id + transaction_no)
    const matchedBox = boxes.find((b: any) =>
      isMatch(String(b.box_id || "").trim(), String(b.transaction_no || "").trim())
    )

    if (matchedBox) {
      const article = matchedBox.article || "Unknown"

      // When boxes cover all lines, OR lines are synthesized from boxes (cold storage),
      // the UI shows lines (not boxes). So we must acknowledge the corresponding LINE
      // for the count to update.
      if (linesAreBoxes || allLinesCoveredByBoxes) {
        // Find the line that corresponds to this box via lineBoxDataMap
        let lineIdx = lines.findIndex((l: any) => {
          const boxRef = lineBoxDataMap[l.id] || {}
          return String(boxRef.box_id || "").trim() === String(matchedBox.box_id || "").trim()
            && String(boxRef.transaction_no || "").trim() === String(matchedBox.transaction_no || "").trim()
        })
        // Fallback: match by transfer_line_id
        if (lineIdx < 0) {
          lineIdx = lines.findIndex((l: any) => l.id === matchedBox.transfer_line_id)
        }
        // Fallback: match by index position (box[i] = line[i])
        if (lineIdx < 0) {
          const boxIdx = boxes.findIndex((b: any) => b.id === matchedBox.id)
          if (boxIdx >= 0 && boxIdx < lines.length) lineIdx = boxIdx
        }

        if (lineIdx >= 0) {
          if (linesMatchMap[lineIdx]) {
            setScanResult({ type: "already", message: `Already Acknowledged — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
            return
          }
          const scanRef = {
            box_id: String(matchedBox.box_id || scannedBoxId || ""),
            transaction_no: String(matchedBox.transaction_no || scannedTransactionNo || ""),
          }
          setScannedLineData(prev => ({ ...prev, [lineIdx]: scanRef }))
          await handleAcknowledgeLine(lineIdx, scanRef)
          setScanResult({ type: "match", message: `Matched — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
          return
        }
      }

      // Normal flow: acknowledge the box directly
      if (boxesMatchMap[matchedBox.id]) {
        setScanResult({ type: "already", message: `Already Acknowledged — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
        return
      }
      // Pass the SCANNED box_id (not the placeholder) so STBR sees ground truth
      const actualScannedId = scannedBoxId || String(matchedBox.box_id || "")
      await handleAcknowledgeBox(matchedBox.id, actualScannedId)
      // If STBR reconciled this row, reflect the actual id in the scan result
      const rec = boxReconciliationMap[matchedBox.id]
      const displayId = rec?.actual_box_id || scannedBoxId || "N/A"
      const recSuffix = rec && rec.status && rec.status !== "noop" && rec.status !== "matched"
        ? ` · Reconciled${rec.propagated_count ? ` (+${rec.propagated_count})` : ""}`
        : ""
      setScanResult({ type: "match", message: `Matched — ${article} | Box ID: ${displayId} | Transaction: ${scannedTransactionNo || "N/A"}${recSuffix}` })
      return
    }

    // Match against lines via lineBoxDataMap (box_id + transaction_no from DB)
    const matchedLineIndex = lines.findIndex((l: any) => {
      const boxRef = lineBoxDataMap[l.id] || {}
      const lBoxId = String(l.box_id || boxRef.box_id || "").trim()
      const lTxnNo = String(l.transaction_no || boxRef.transaction_no || "").trim()
      return isMatch(lBoxId, lTxnNo)
    })

    if (matchedLineIndex >= 0) {
      const line = lines[matchedLineIndex]
      const articleName = line.item_desc_raw || line.item_description || "Unknown"
      if (linesMatchMap[matchedLineIndex]) {
        setScanResult({ type: "already", message: `Already Acknowledged — ${articleName} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
        return
      }
      const scanRef = { box_id: scannedBoxId, transaction_no: scannedTransactionNo }
      setScannedLineData(prev => ({ ...prev, [matchedLineIndex]: scanRef }))
      await handleAcknowledgeLine(matchedLineIndex, scanRef)
      setScanResult({ type: "match", message: `Matched — ${articleName} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
      return
    }

    setScanResult({ type: "no-match", message: `Not Matched — Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
  }

  // ── Print QR & auto-acknowledge (for cold storage FROM transfers) ──
  const handlePrintQR = useCallback(async (
    lineIndex: number,
    opts?: { skipAcknowledge?: boolean; issueOverride?: { remarks: string; net_weight?: string; total_weight?: string; case_pack?: string } }
  ) => {
    const line = lines[lineIndex]
    if (!line) return

    // Auto-acknowledge via API — skip only when caller explicitly requests it (e.g. re-print after issue)
    if (!opts?.skipAcknowledge) {
      const headerId = await ensurePendingHeader()
      if (headerId) {
        try {
          const w = lineWeights[lineIndex] || {}
          const boxRef = lineBoxDataMap[line.id] || {}
          const articleName = line.item_desc_raw || line.item_description || ""
          await InterunitApiService.acknowledgeBox(headerId, {
            box_id: generatedBoxIds[lineIndex] || line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`,
            article: articleName,
            batch_number: line.batch_number || null,
            lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
            transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
            net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
            gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
            is_matched: true,
            line_index: lineIndex,
          })
          setLinesMatchMap(prev => ({ ...prev, [lineIndex]: true }))
        } catch (err: any) {
          console.warn("Failed to persist QR acknowledge:", err)
          toast.error("QR printed but failed to save acknowledgment to server")
          return
        }
      } else {
        toast.error("Could not create pending transfer. QR not printed.")
        return
      }
    }

    const boxData = lineBoxDataMap[line.id] || {}
    const weights = lineWeights[lineIndex] || {}
    const issueData = opts?.issueOverride ?? linesIssueMap[lineIndex]
    const netWt = issueData?.net_weight ? parseFloat(issueData.net_weight) : parseFloat(weights.net_weight || line.net_weight || "0")
    const grossWt = issueData?.total_weight ? parseFloat(issueData.total_weight) : parseFloat(weights.total_weight || line.total_weight || "0")
    const issueCasePack = issueData?.case_pack || ""
    const hasIssue = !!issueData
    const itemName = line.item_desc_raw || line.item_description || `Article ${lineIndex + 1}`
    // Prefer session-generated values over raw line data
    const txNo = inwardTransactionNo || line.transaction_no || boxData.transaction_no || ""
    const bId = generatedBoxIds[lineIndex] || line.box_id || boxData.box_id || ""
    const lotNo = line.lot_number || ""
    const boxNum = lineIndex + 1

    const formatDate = (d: string) => {
      if (!d) return ""
      try {
        return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
      } catch { return "" }
    }
    const dateStr = formatDate(new Date().toISOString())

    // QR encodes box_id and transaction_no (same format as inward)
    const qrDataString = JSON.stringify({ tx: txNo, bi: bId })

    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrDataString, {
        width: 170,
        margin: 1,
        errorCorrectionLevel: "M",
      })

      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) return

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Label</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 4in; height: 2in; overflow: hidden; background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { width: 4in; height: 2in; overflow: hidden; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          * { visibility: visible; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; page-break-after: avoid; page-break-inside: avoid; }
        .qr { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 2in; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; }
        .company { font-weight: bold; font-size: 9pt; }
        .txn { font-family: monospace; font-size: 7pt; }
        .boxid { font-family: monospace; font-size: 6.5pt; color: #555; }
        .item { font-weight: bold; font-size: 7.5pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .detail { font-size: 7pt; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
        .issue-tag { display: inline-block; background: #fee2e2; color: #dc2626; font-size: 6pt; font-weight: bold; padding: 1px 4px; border-radius: 2px; border: 1px solid #fca5a5; margin-left: 4px; }
        .issue-vals { font-size: 6.5pt; color: #dc2626; }
      </style></head><body>
        <div class="label">
          <div class="qr"><img src="${qrCodeDataURL}" /></div>
          <div class="info">
            <div>
              <div class="company">${company}${hasIssue ? '<span class="issue-tag">ISSUE</span>' : ''}</div>
              <div class="txn">${txNo || "—"}</div>
              <div class="boxid">ID: ${bId || "—"}</div>
            </div>
            <div class="item">${itemName}</div>
            <div>
              <div class="detail"><b>Box #${boxNum}</b> &nbsp; Net: ${netWt}kg &nbsp; Gross: ${grossWt}kg</div>
              ${hasIssue && issueCasePack ? `<div class="issue-vals">Case Pack: ${issueCasePack}</div>` : ''}
              <div class="detail">Date: ${dateStr}</div>
            </div>
            <div class="lot">${(lotNo).substring(0, 20)}</div>
          </div>
        </div>
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
        if (e.data === "print-complete") {
          window.removeEventListener("message", cleanup)
          document.body.removeChild(iframe)
        }
      }
      window.addEventListener("message", cleanup)

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
      }, 30000)

      toast.success(`${itemName} — Box #${boxNum} acknowledged`)
    } catch (err) {
      console.error("QR generation failed:", err)
      toast.error("Failed to generate QR code")
    }
  }, [lines, lineBoxDataMap, lineWeights, transferData, company, toast, inwardTransactionNo, generatedBoxIds, linesIssueMap])

  // ── Generate & print QR codes for all acknowledged boxes (bulk inward QR generation) ──
  const handleGenerateQRs = useCallback(async () => {
    if (!transferData || !lines.length) return
    setGeneratingQRs(true)
    try {
      // ── Generate transaction_no + box_ids client-side (same logic as backend) ──
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const txNo = `TR-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
      // box_id = last 8 digits of epoch ms + "-" + 1-based box number (mirrors backend generate_box_ids)
      const base = String(Date.now()).slice(-8)
      const boxIdMap: Record<number, string> = {}
      lines.forEach((_: any, i: number) => { boxIdMap[i] = `${base}-${i + 1}` })

      // Update UI immediately so columns fill in
      setInwardTransactionNo(txNo)
      setGeneratedBoxIds(boxIdMap)

      console.log(`✅ [GENERATE-QR] tx=${txNo} | boxes=${lines.length} | base=${base}`, boxIdMap)
      toast.success(`${lines.length} QR${lines.length !== 1 ? "s" : ""} assigned — TX: ${txNo} · use Print QR per row to print`)
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QRs")
    } finally {
      setGeneratingQRs(false)
    }
  }, [transferData, lines, company])

  // ── Per-article box range reprint ──
  const handlePrintRange = useCallback(async (articleName: string) => {
    const indices = articleLineGroups[articleName] || []
    const from = (articleRangeFrom[articleName] ?? 1) - 1   // convert to 0-based
    const to = articleRangeTo[articleName] ?? indices.length // exclusive upper, defaults to all
    const rangeIndices = indices.slice(from, to)
    if (rangeIndices.length === 0) { toast.error("No boxes in selected range"); return }

    try {
      const labelHtmlParts: string[] = []
      for (let ri = 0; ri < rangeIndices.length; ri++) {
        const idx = rangeIndices[ri]
        const line = lines[idx]
        if (!line) continue
        const txNo = inwardTransactionNo || line.transaction_no || generatedBoxIds[idx] || ""
        const bId = generatedBoxIds[idx] || line.box_id || ""
        if (!txNo || !bId) continue
        const qrPayload = JSON.stringify({ tx: txNo, bi: bId })
        const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 200, margin: 1, errorCorrectionLevel: "M" })
        const isLast = ri === rangeIndices.length - 1
        const issueData = linesIssueMap[idx]
        const netWt = issueData?.net_weight ? parseFloat(issueData.net_weight) : parseFloat(line.net_weight || "0")
        labelHtmlParts.push(`
          <div style="width:4in;height:2in;display:flex;align-items:stretch;border:1px solid #000;padding:0.1in;box-sizing:border-box;${isLast ? "" : "page-break-after:always"}">
            <div style="width:1.7in;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
              <img src="${qrDataUrl}" style="width:1.7in;height:1.7in;object-fit:contain;" />
            </div>
            <div style="flex:1;padding-left:0.1in;display:flex;flex-direction:column;justify-content:center;gap:2px;font-family:monospace;overflow:hidden;">
              <div style="font-size:9pt;font-weight:bold;">${company.toUpperCase()}</div>
              <div style="font-size:8pt;color:#555;">TX: ${txNo}</div>
              <div style="font-size:8pt;color:#555;">Box: ${bId}</div>
              <div style="font-size:8pt;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${articleName}</div>
              ${line.lot_number ? `<div style="font-size:7pt;color:#666;">Lot: ${line.lot_number}</div>` : ""}
              <div style="font-size:7pt;color:#666;">Net: ${netWt.toFixed(3)} kg  |  Box ${idx + 1}${issueData ? "  ⚠ Issue" : ""}</div>
            </div>
          </div>
        `)
      }
      if (labelHtmlParts.length === 0) { toast.error("No QR data for selected range"); return }
      const iframe = document.createElement("iframe")
      iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;"
      document.body.appendChild(iframe)
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(`<!DOCTYPE html><html><head><style>@page{size:4in 2in;margin:0}body{margin:0;padding:0}</style></head><body>${labelHtmlParts.join("")}</body></html>`)
        doc.close()
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
      }
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe) }, 30000)
      toast.success(`${labelHtmlParts.length} QR label${labelHtmlParts.length !== 1 ? "s" : ""} reprinted`)
    } catch (err: any) {
      toast.error(err.message || "Failed to print range")
    }
  }, [articleLineGroups, articleRangeFrom, articleRangeTo, lines, inwardTransactionNo, generatedBoxIds, linesIssueMap, company])

  // ── Bulk QR Print state ──
  const [bulkFromBox, setBulkFromBox] = useState<number>(1)
  const [bulkToBox, setBulkToBox] = useState<number>(1)
  const [bulkEmptyCartonWeights, setBulkEmptyCartonWeights] = useState<Record<string, string>>({})
  const [bulkPrinting, setBulkPrinting] = useState(false)

  // Update bulkToBox default when lines load
  useEffect(() => {
    if (lines.length > 0) setBulkToBox(lines.length)
  }, [lines.length])

  // Unique articles in selected range for empty carton weight inputs
  const bulkRangeArticles = useMemo(() => {
    const fromIdx = Math.max(0, bulkFromBox - 1)
    const toIdx = Math.min(lines.length, bulkToBox)
    const rangeLines = lines.slice(fromIdx, toIdx)
    const seen = new Set<string>()
    const articles: string[] = []
    rangeLines.forEach((line: any) => {
      const name = line.item_desc_raw || line.item_description || "Unknown"
      if (!seen.has(name)) {
        seen.add(name)
        articles.push(name)
      }
    })
    return articles
  }, [lines, bulkFromBox, bulkToBox])

  // Track original total_weight per line (before empty carton weight adjustment)
  const originalTotalWeightsRef = useRef<Record<number, string>>({})
  useEffect(() => {
    if (lines.length > 0 && Object.keys(originalTotalWeightsRef.current).length === 0) {
      const originals: Record<number, string> = {}
      lines.forEach((line: any, i: number) => {
        const w = lineWeights[i] || {}
        originals[i] = w.total_weight || line.total_weight || "0"
      })
      originalTotalWeightsRef.current = originals
    }
  }, [lines, lineWeights])

  // ── Dynamic update of total_weight (gross) when empty carton weight changes ──
  useEffect(() => {
    if (Object.keys(bulkEmptyCartonWeights).length === 0) return
    const fromIdx = Math.max(0, bulkFromBox - 1)
    const toIdx = Math.min(lines.length, bulkToBox)

    setLineWeights(prev => {
      const updated = { ...prev }
      for (let i = fromIdx; i < toIdx; i++) {
        const line = lines[i]
        if (!line) continue
        if (linesMatchMap[i] || linesIssueMap[i]) continue // skip already acknowledged/issued

        const articleName = line.item_desc_raw || line.item_description || "Unknown"
        const cartonWtStr = bulkEmptyCartonWeights[articleName] || ""
        const cartonWt = parseFloat(cartonWtStr)

        const origTotal = originalTotalWeightsRef.current[i] || prev[i]?.total_weight || line.total_weight || "0"
        const netWt = parseFloat(prev[i]?.net_weight || line.net_weight || "0")

        if (cartonWtStr !== "" && !isNaN(cartonWt) && cartonWt > 0) {
          // Add empty carton weight to net weight to get gross (total_weight)
          updated[i] = { ...updated[i], total_weight: (netWt + cartonWt).toFixed(2) }
        } else {
          // Reset to original total_weight when carton weight is cleared
          updated[i] = { ...updated[i], total_weight: String(origTotal) }
        }
      }
      return updated
    })
  }, [bulkEmptyCartonWeights, bulkFromBox, bulkToBox, lines, linesMatchMap, linesIssueMap])

  // ── Bulk Print QR handler ──
  const handleBulkPrintQR = useCallback(async () => {
    const fromIdx = Math.max(0, bulkFromBox - 1)
    const toIdx = Math.min(lines.length, bulkToBox)
    if (fromIdx >= toIdx) {
      toast.error("Invalid box range")
      return
    }

    // Validate empty carton weights (only validate if a value is entered)
    for (const article of bulkRangeArticles) {
      const val = bulkEmptyCartonWeights[article] || ""
      if (val !== "" && val !== "0") {
        const wt = parseFloat(val)
        if (isNaN(wt) || wt < 0) {
          toast.error(`Please enter a valid empty carton weight for ${article}`)
          return
        }
      }
    }

    setBulkPrinting(true)
    const headerId = await ensurePendingHeader()
    if (!headerId) {
      setBulkPrinting(false)
      toast.error("Could not create pending transfer")
      return
    }

    // Build batch acknowledge items with calculated gross weights
    const batchItems: any[] = []
    const labelData: any[] = []

    for (let i = fromIdx; i < toIdx; i++) {
      const line = lines[i]
      if (!line) continue
      if (linesMatchMap[i] || linesIssueMap[i]) continue // skip already acknowledged/issued

      const articleName = line.item_desc_raw || line.item_description || "Unknown"
      const emptyCartonWt = parseFloat(bulkEmptyCartonWeights[articleName] || "0")
      const w = lineWeights[i] || {}
      const netWt = parseFloat(w.net_weight || line.net_weight || "0")
      const calculatedGrossWt = netWt + emptyCartonWt

      // Update lineWeights with calculated gross weight (total_weight)
      if (emptyCartonWt > 0) {
        setLineWeights(prev => ({
          ...prev,
          [i]: { ...prev[i], total_weight: calculatedGrossWt.toFixed(2) },
        }))
      }

      const boxRef = lineBoxDataMap[line.id] || {}
      const boxId = generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`
      const txNo = inwardTransactionNo || line.transaction_no || boxRef.transaction_no || ""

      batchItems.push({
        box_id: boxId,
        article: articleName,
        batch_number: line.batch_number || null,
        lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
        transaction_no: txNo || null,
        net_weight: netWt,
        gross_weight: calculatedGrossWt,
        is_matched: true,
        line_index: i,
      })

      const lineIssue = linesIssueMap[i]
      labelData.push({
        index: i,
        itemName: articleName,
        boxId,
        txNo,
        netWt,
        grossWt: calculatedGrossWt,
        lotNo: line.lot_number || "",
        boxNum: i + 1,
        hasIssue: !!lineIssue,
        issueCasePack: lineIssue?.case_pack || "",
      })
    }

    if (batchItems.length === 0) {
      setBulkPrinting(false)
      toast.info("All boxes in range already acknowledged")
      return
    }

    // Batch acknowledge
    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchItems)
      const newMap = { ...linesMatchMap }
      batchItems.forEach((item: any) => { newMap[item.line_index] = true })
      setLinesMatchMap(newMap)
    } catch (err: any) {
      setBulkPrinting(false)
      toast.error(err.message || "Failed to batch acknowledge")
      return
    }

    // Generate all QR labels in a single print window
    const transferNo = transferData?.challan_no || transferData?.transfer_no || ""
    const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })

    try {
      const qrPromises = labelData.map(async (ld) => {
        const qrDataString = JSON.stringify({ tx: ld.txNo, bi: ld.boxId })
        const qrCodeDataURL = await QRCode.toDataURL(qrDataString, { width: 170, margin: 1, errorCorrectionLevel: "M" })
        return { ...ld, qrCodeDataURL }
      })
      const labelsWithQR = await Promise.all(qrPromises)

      const labelsHtml = labelsWithQR.map((ld) => `
        <div class="label">
          <div class="qr"><img src="${ld.qrCodeDataURL}" /></div>
          <div class="info">
            <div>
              <div class="company">${company}${ld.hasIssue ? '<span class="issue-tag">ISSUE</span>' : ''}</div>
              <div class="txn">${transferNo}</div>
              <div class="boxid">ID: ${ld.boxId}</div>
            </div>
            <div class="item">${ld.itemName}</div>
            <div>
              <div class="detail"><b>Box #${ld.boxNum}</b> &nbsp; Net: ${ld.netWt.toFixed(2)}kg &nbsp; Gross: ${ld.grossWt.toFixed(2)}kg</div>
              ${ld.hasIssue && ld.issueCasePack ? `<div class="issue-vals">Case Pack: ${ld.issueCasePack}</div>` : ''}
              <div class="detail">Date: ${dateStr}</div>
            </div>
            <div class="lot">${(ld.lotNo).substring(0, 20)}</div>
          </div>
        </div>
      `).join("\n")

      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.left = "-9999px"
      iframe.style.top = "-9999px"
      iframe.style.width = "0"
      iframe.style.height = "0"
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { setBulkPrinting(false); return }

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Bulk Labels</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: avoid; }
        .qr { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 2in; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; }
        .company { font-weight: bold; font-size: 9pt; }
        .txn { font-family: monospace; font-size: 7pt; }
        .boxid { font-family: monospace; font-size: 6.5pt; color: #555; }
        .item { font-weight: bold; font-size: 7.5pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .detail { font-size: 7pt; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
        .issue-tag { display: inline-block; background: #fee2e2; color: #dc2626; font-size: 6pt; font-weight: bold; padding: 1px 4px; border-radius: 2px; border: 1px solid #fca5a5; margin-left: 4px; }
        .issue-vals { font-size: 6.5pt; color: #dc2626; }
      </style></head><body>
        ${labelsHtml}
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
        if (e.data === "print-complete") {
          window.removeEventListener("message", cleanup)
          document.body.removeChild(iframe)
        }
      }
      window.addEventListener("message", cleanup)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
          window.removeEventListener("message", cleanup)
        }
      }, 60000)

      toast.success(`${labelsWithQR.length} QR labels sent to printer`)
    } catch (err) {
      console.error("Bulk QR generation failed:", err)
      toast.error("Failed to generate bulk QR codes")
    } finally {
      setBulkPrinting(false)
    }
  }, [lines, bulkFromBox, bulkToBox, bulkEmptyCartonWeights, bulkRangeArticles, lineWeights, lineBoxDataMap, linesMatchMap, linesIssueMap, transferData, company, generatedBoxIds, inwardTransactionNo])

  const handleConfirmReceipt = async () => {
    if (!transferData) return

    try {
      setLoading(true)

      if (pendingHeaderId) {
        // ── Safety re-sync: re-send every locally-acknowledged item before finalize ──
        // Covers cases where a batch acknowledge silently missed data, or where the user
        // edited weights / lot numbers AFTER clicking "Acknowledge All".
        const syncBatch: any[] = []

        lines.forEach((line: any, i: number) => {
          const isMatched = !!linesMatchMap[i]
          const issue = linesIssueMap[i]
          if (!isMatched && !issue) return

          const w = lineWeights[i] || {}
          const boxRef = lineBoxDataMap[line.id] || {}
          const articleName = line.item_desc_raw || line.item_description || ""
          syncBatch.push({
            box_id: generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`,
            article: articleName,
            batch_number: line.batch_number || null,
            lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
            transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
            net_weight: issue?.net_weight
              ? Number(issue.net_weight)
              : (w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null)),
            gross_weight: issue?.total_weight
              ? Number(issue.total_weight)
              : (w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null)),
            is_matched: !issue,
            issue: issue
              ? {
                  remarks: issue.remarks || null,
                  net_weight: issue.net_weight || null,
                  total_weight: issue.total_weight || null,
                  case_pack: issue.case_pack || null,
                }
              : null,
            line_index: i,
          })
        })

        // In cold-storage mode OR when boxes cover all lines, the lines loop above
        // already covers every box (lines are synthesized from boxes). Iterating
        // boxes here would push duplicates → doubled rows in transfer_in_boxes
        // and a stuck "Partially Received" status.
        if (!linesAreBoxes && !allLinesCoveredByBoxes) {
          boxes.forEach((b: any) => {
            if (!boxesMatchMap[b.id]) return
            const articleName = b.article ? String(b.article) : ""
            syncBatch.push({
              box_id: String(b.box_id || b.box_number || b.id || ""),
              transfer_out_box_id: b.id,
              article: articleName || null,
              batch_number: b.batch_number ? String(b.batch_number) : null,
              lot_number: dedicatedLot(b) || (b.lot_number ? String(b.lot_number) : null),
              transaction_no: b.transaction_no ? String(b.transaction_no) : null,
              net_weight: b.net_weight ? Number(b.net_weight) : null,
              gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
              is_matched: true,
            })
          })
        }

        if (syncBatch.length > 0) {
          await InterunitApiService.acknowledgeBatch(pendingHeaderId, syncBatch)
        }

        // ── Finalize pending transfer-in (boxes already in DB from real-time acknowledges) ──
        const finalizePayload: any = {
          box_condition: boxCondition,
          condition_remarks: conditionRemarks.trim() || null,
        }

        await InterunitApiService.finalizeTransferIn(pendingHeaderId, finalizePayload)

        toast.success(`GRN ${pendingGrnNumber} finalized successfully.`)
      } else {
        // ── Fallback: original bulk-create path (no pending header) ──
        // In cold-storage mode OR when boxes cover all lines, the article loops
        // below already cover every box. Skip the boxes-array iteration to avoid
        // pushing duplicate rows.
        const scannedBoxes = (linesAreBoxes || allLinesCoveredByBoxes)
          ? []
          : boxes
              .filter((b: any) => boxesMatchMap[b.id])
              .map((b: any) => {
                const articleName = b.article ? String(b.article) : ""
                return {
                  box_id: String(b.box_id || b.box_number || b.id || ""),
                  transfer_out_box_id: b.id,
                  article: articleName || null,
                  batch_number: b.batch_number ? String(b.batch_number) : null,
                  lot_number: dedicatedLot(b) || (b.lot_number ? String(b.lot_number) : null),
                  transaction_no: b.transaction_no ? String(b.transaction_no) : null,
                  net_weight: b.net_weight ? Number(b.net_weight) : null,
                  gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
                  is_matched: true,
                }
              })


        const acknowledgedArticles = lines
          .map((line: any, i: number) => ({ line, i }))
          .filter(({ i }: any) => linesMatchMap[i])
          .map(({ line, i }: any) => {
            const w = lineWeights[i] || {}
            const boxRef = lineBoxDataMap[line.id] || {}
            const articleName = line.item_desc_raw || line.item_description || ""
            return {
              box_id: generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`,
              transfer_out_box_id: null,
              article: articleName,
              batch_number: line.batch_number || null,
              lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
              transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
              net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
              gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
              is_matched: true,
              issue: null,
            }
          })

        const issuedArticles = lines
          .map((line: any, i: number) => ({ line, i }))
          .filter(({ i }: any) => linesIssueMap[i])
          .map(({ line, i }: any) => {
            const w = lineWeights[i] || {}
            const boxRef = lineBoxDataMap[line.id] || {}
            const articleName = line.item_desc_raw || line.item_description || ""
            return {
              box_id: generatedBoxIds[i] || line.box_id || boxRef.box_id || `ART-${i + 1}`,
              transfer_out_box_id: null,
              article: articleName,
              batch_number: line.batch_number || null,
              lot_number: dedicatedLot(line?._box_origin) || line.lot_number || null,
              transaction_no: boxRef.transaction_no || line.transaction_no || inwardTransactionNo || null,
              net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
              gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
              is_matched: false,
              issue: {
                remarks: linesIssueMap[i].remarks || null,
                net_weight: linesIssueMap[i].net_weight || null,
                total_weight: linesIssueMap[i].total_weight || null,
                case_pack: linesIssueMap[i].case_pack || null,
              },
            }
          })

        const allScannedBoxes = [...scannedBoxes, ...acknowledgedArticles, ...issuedArticles]

        const now = new Date()
        const grnNumber = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`

        const payload: any = {
          transfer_out_id: transferData.id,
          grn_number: grnNumber,
          receiving_warehouse: transferData.to_warehouse || transferData.to_site_code || "UNKNOWN",
          received_by: user?.name || user?.email || "USER",
          box_condition: boxCondition,
          condition_remarks: conditionRemarks.trim() || null,
          scanned_boxes: allScannedBoxes,
        }

        await InterunitApiService.createTransferIn(payload)

        toast.success(`GRN ${grnNumber} created successfully with ${allScannedBoxes.length} items.`)
      }

      setTimeout(() => {
        router.push(`/${company}/transfer`)
      }, 2000)
    } catch (error: any) {
      console.error("Failed to confirm transfer:", error)
      toast.error(error.message || "Failed to confirm transfer receipt")
    } finally {
      setLoading(false)
    }
  }

  // Step 4 — close a partial receipt as a genuine shortage: receive the acknowledged
  // boxes, write off the unreceived (still in-transit) ones, and mark both headers
  // Received. Only for boxes that are truly not coming (the bridge invariant otherwise
  // correctly keeps the transfer Pending).
  const handleCloseWithShortage = async () => {
    const headerId = await ensurePendingHeader()
    if (!headerId) {
      toast.error("Acknowledge at least one box before closing with a shortage")
      return
    }
    setClosingShortage(true)
    try {
      const res = await InterunitApiService.closeTransferInWithShortage(
        headerId,
        user?.email || "",
        shortageReason.trim() || undefined,
      )
      const written = res?.written_off ?? res?.shortage ?? Math.max(totalItems - totalMatched, 0)
      toast.success(`Receipt closed with shortage — ${written} box(es) written off.`)
      setShortageDialogOpen(false)
      setShortageReason("")
      setTimeout(() => router.push(`/${company}/transfer`), 1500)
    } catch (err: any) {
      toast.error(err?.message || "Failed to close with shortage")
    } finally {
      setClosingShortage(false)
    }
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 bg-gray-50 min-h-screen">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/${company}/transfer`)}
          className="h-9 w-9 p-0 bg-white border-gray-200 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Inbox className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            Transfer IN
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Receive incoming stock transfers</p>
        </div>
        {canReopenReceived && transferData?.status === "Received" && (
          <Button
            variant="outline" size="sm"
            className="h-9 gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 shrink-0"
            onClick={handleReopenReceipt}
            disabled={reopening}
            title="Re-open this received transfer-in to correct a lot number or raise a box issue"
          >
            {reopening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Re-open receipt
          </Button>
        )}
        {canReopenReceived && transferData?.status === "Received" && (
          <Button
            variant="outline" size="sm"
            className="h-9 gap-1.5 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 shrink-0"
            onClick={() => setEditOpen(true)}
            title="Edit this received transfer-in (header + box details)"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit receipt
          </Button>
        )}
        <EditReceiptDialog
          open={editOpen}
          transferOutId={transferData?.id ?? null}
          userEmail={user?.email || ""}
          onClose={() => setEditOpen(false)}
          onSaved={() => loadTransferDetails(transferData?.challan_no || transferData?.transfer_no || transferNumber)}
        />
      </div>

      {/* ── Transfer Number Input ── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
          <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Find Transfer</CardTitle>
          <p className="text-xs text-muted-foreground">Enter the transfer number</p>
        </CardHeader>
        <CardContent className="p-3 sm:p-5">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="transferNumber" className="text-xs font-medium text-gray-600">Transfer Number *</Label>
                <Input
                  id="transferNumber"
                  type="text"
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="h-10 bg-white border-gray-200"
                  placeholder="TRANS202510191445"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSearch}
                  disabled={loading || !transferNumber.trim()}
                  className="flex-1 sm:flex-initial h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-1.5" /><span>Search</span></>}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Transfer Details ── */}
      {transferData && (
        <>
          {/* ══════ Transfer Route Info ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                    <Building2 className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-800">{transferData.from_warehouse || transferData.from_site || 'N/A'}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="flex items-center gap-2 bg-teal-50 px-3 py-2 rounded-lg">
                    <Building2 className="h-4 w-4 text-teal-600" />
                    <span className="font-semibold text-teal-800">{transferData.to_warehouse || transferData.to_site || 'N/A'}</span>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {transferData.challan_no || transferData.transfer_no}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* ══════ Box & Article Acknowledgement ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-600" />
                    Box & Article Acknowledgement
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transferData.challan_no || transferData.transfer_no} — {totalBoxes} boxes, {uniqueArticleCount || totalLines} article{(uniqueArticleCount || totalLines) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                    {totalMatched} resolved
                  </Badge>
                  {issuedLines > 0 && (
                    <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                      <AlertTriangle className="h-3 w-3 mr-0.5" /> {issuedLines} issue{issuedLines !== 1 ? "s" : ""}
                    </Badge>
                  )}
                  {totalItems - totalMatched > 0 && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-600 border-amber-200">
                      {totalItems - totalMatched} pending
                    </Badge>
                  )}
                </div>
              </div>
              {!allMatched && totalItems > 0 && isAuthorizedUser && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAcknowledgeAll}
                  className="mt-3 h-9 text-xs sm:text-sm bg-white border-teal-200 text-teal-700 hover:bg-teal-50 w-full sm:w-auto"
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  Acknowledge All ({totalItems})
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">

              {/* ──── SCAN BOX TO ACKNOWLEDGE ──── */}
              {totalLines > 0 && !allMatched && (
                <div className="px-3 sm:px-4 py-3 border-b border-gray-200 bg-blue-50/40">
                  {!showAckScanner ? (
                    <div className="py-2 text-center">
                      <Button
                        type="button"
                        onClick={() => { setShowAckScanner(true); setScanResult(null) }}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 w-full sm:w-auto"
                      >
                        <Camera className="h-4 w-4 mr-2" /> Start Camera Scan
                      </Button>
                      <p className="text-xs text-gray-500 mt-2">
                        Scan QR codes to auto-acknowledge boxes
                      </p>
                    </div>
                  ) : (
                    <div className="py-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-700 flex items-center gap-2">
                          <Camera className="h-4 w-4" /> Scanning...
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setShowAckScanner(false); setScanResult(null) }}
                          className="h-8 px-3 text-xs"
                        >
                          <X className="h-3.5 w-3.5 mr-1" /> Close
                        </Button>
                      </div>
                      <div className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
                        <HighPerformanceQRScanner
                          onScanSuccess={handleAckQRScan}
                          onScanError={handleQRScanError}
                          onClose={() => setShowAckScanner(false)}
                          continuous={true}
                        />
                      </div>
                      {scanResult && (
                        <div className={`mt-3 p-3 rounded-lg text-sm font-medium flex items-center gap-2 ${
                          scanResult.type === "match" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                          scanResult.type === "already" ? "bg-amber-50 text-amber-800 border border-amber-200" :
                          scanResult.type === "no-match" ? "bg-red-50 text-red-800 border border-red-200" :
                          "bg-red-50 text-red-800 border border-red-200"
                        }`}>
                          {scanResult.type === "match" && <CheckCircle className="h-4 w-4 shrink-0" />}
                          {scanResult.type === "already" && <AlertTriangle className="h-4 w-4 shrink-0" />}
                          {scanResult.type === "no-match" && <X className="h-4 w-4 shrink-0" />}
                          {scanResult.type === "error" && <AlertTriangle className="h-4 w-4 shrink-0" />}
                          {scanResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ──── BULK QR PRINT BAR (cold storage FROM transfers) ──── */}
              {totalLines > 0 && isColdStorageFrom && (
                <div className="px-3 sm:px-4 py-3 border-b-2 border-blue-200 bg-blue-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Printer className="h-4 w-4 text-blue-600" />
                    <span className="text-xs sm:text-sm font-semibold text-blue-800">Bulk Print QR</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">From Box #</Label>
                      <Input
                        type="number"
                        min={1}
                        max={totalLines}
                        value={bulkFromBox}
                        onChange={(e) => setBulkFromBox(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">To Box #</Label>
                      <Input
                        type="number"
                        min={1}
                        max={totalLines}
                        value={bulkToBox}
                        onChange={(e) => setBulkToBox(Math.min(totalLines, parseInt(e.target.value) || 1))}
                        className="h-9 bg-white border-gray-200 text-sm"
                      />
                    </div>
                  </div>
                  {bulkRangeArticles.length > 0 && (
                    <div className="mb-3">
                      <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Empty Carton Weight per Article (kg)</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {bulkRangeArticles.map((article) => (
                          <div key={article} className="flex items-center gap-2 bg-white rounded-md border border-gray-200 px-2.5 py-1.5">
                            <span className="text-xs font-medium text-gray-700 truncate flex-1" title={article}>{article}</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={bulkEmptyCartonWeights[article] || ""}
                              onChange={(e) => setBulkEmptyCartonWeights(prev => ({ ...prev, [article]: e.target.value }))}
                              placeholder="0.00"
                              className="h-7 w-24 text-xs bg-gray-50 border-gray-200"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    onClick={handleBulkPrintQR}
                    disabled={bulkPrinting || bulkRangeArticles.length === 0}
                    className="h-9 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-medium w-full sm:w-auto"
                  >
                    {bulkPrinting ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Printing...</>
                    ) : (
                      <><Printer className="h-3.5 w-3.5 mr-1.5" /> Bulk Print QR ({Math.min(bulkToBox, totalLines) - Math.max(0, bulkFromBox - 1)} boxes)</>
                    )}
                  </Button>
                </div>
              )}

              {/* ──── ARTICLE LINES SECTION ──── */}
              {totalLines > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-violet-50/60">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-600" />
                      <span className="text-xs sm:text-sm font-semibold text-violet-800">Article Entries ({totalLines})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-xs ${resolvedLines === totalLines ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {resolvedLines}/{totalLines}
                      </Badge>
                      {issuedLines > 0 && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                          {issuedLines} issue{issuedLines !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {resolvedLines < totalLines && isAuthorizedUser && (
                        <Button variant="ghost" size="sm" onClick={handleAcknowledgeAllLines} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                          <CheckCheck className="h-3 w-3 mr-1" /> All
                        </Button>
                      )}
                      {/* ── Generate QR's button — enabled only when boxes have no box_id/transaction_no yet ── */}
                      {(() => {
                        // Mixed scan + manual: scanned boxes are already tagged by the outward
                        // side, but manually-typed Article Entries still need ids. Gate on whether
                        // any *displayed entry* still lacks an id — not on whether the scanned
                        // boxes happen to be tagged (the old check disabled the button in mixed mode).
                        // LINE-style placeholders are sentinels (pending_stock_tools.py) — not real ids.
                        const lineHasId = (l: any, i: number) =>
                          !!generatedBoxIds[i] ||
                          (!!l.box_id && !isSyntheticLineBoxId(l.box_id)) ||
                          !!(lineBoxDataMap[l.id]?.box_id)
                        const linesNeedingQr = lines.some((l: any, i: number) => !lineHasId(l, i))
                        const qrsGeneratedNow = !!inwardTransactionNo
                        const canGenerate = !generatingQRs && !!transferData && !qrsGeneratedNow && linesNeedingQr
                        const existingTx = inwardTransactionNo || boxes.find((b: any) => b.transaction_no)?.transaction_no
                        const disabledReason = !transferData
                          ? "Load a transfer first"
                          : qrsGeneratedNow
                          ? `QRs already generated this session — TX: ${inwardTransactionNo}`
                          : !linesNeedingQr
                          ? `All entries already have QR data — TX: ${existingTx || boxes[0]?.transaction_no || "pre-tagged"}`
                          : "Generate QR stickers for entries that need them"
                        return (
                        <button
                          onClick={canGenerate ? handleGenerateQRs : undefined}
                          disabled={!canGenerate}
                          title={disabledReason}
                          className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                            canGenerate
                              ? "bg-violet-50 hover:bg-violet-100 border-violet-300 text-violet-700 cursor-pointer"
                              : "opacity-40 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-500"
                          }`}
                        >
                          {generatingQRs
                            ? <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
                            : <><Printer className="h-3 w-3" />Generate QR ID's</>
                          }
                        </button>
                        )
                      })()}
                      {inwardTransactionNo && (
                        <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">{inwardTransactionNo}</span>
                      )}
                    </div>
                  </div>

                  {/* Desktop table with horizontal scroll */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[1050px] text-sm">
                      <thead>
                        <tr className="bg-violet-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="text-center py-2.5 px-2 w-[50px]">Sr. No.</th>
                          <th className="text-left py-2.5 px-3 min-w-[220px]">Item Name</th>
                          <th className="text-left py-2.5 px-3 w-[130px]">Transaction No</th>
                          <th className="text-left py-2.5 px-3 w-[120px]">Box ID</th>
                          <th className="text-right py-2.5 px-3 w-[90px]">Case Pack</th>
                          <th className="text-right py-2.5 px-3 w-[80px]">Qty</th>
                          <th className="text-right py-2.5 px-3 w-[100px]">Net Wt</th>
                          <th className="text-right py-2.5 px-3 w-[100px]">Total Wt</th>
                          {hasBatchData && <th className="text-left py-2.5 px-3 w-[110px]">Batch</th>}
                          <th className="text-left py-2.5 px-3 w-[110px]">Lot</th>
                          <th className="text-right py-2.5 px-3 w-[160px] sticky right-0 bg-violet-50/40">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line: any, index: number) => {
                          const matched = !!linesMatchMap[index]
                          const issued = !!linesIssueMap[index]
                          const isIssueOpen = issueOpenIndex === index

                          const boxData = lineBoxDataMap[line.id] || {}

                          // Debug log for each line (only log first 3 lines to avoid spam)
                          if (index < 3) {
                            console.log(`🔍 [DEBUG-IN] Rendering Article Entry #${index + 1}:`, {
                              line_id: line.id,
                              item: line.item_desc_raw || line.item_description,
                              line_box_id: line.box_id,
                              line_transaction_no: line.transaction_no,
                              mapped_box_id: boxData.box_id,
                              mapped_transaction_no: boxData.transaction_no,
                              final_box_id: line.box_id || boxData.box_id || "-",
                              final_transaction_no: line.transaction_no || boxData.transaction_no || "-",
                              isColdStorageFrom,
                              willDisplay: isColdStorageFrom ? 'YES' : 'NO (not from cold storage)'
                            })
                          }

                          const totalCols = 9 + (hasBatchData ? 1 : 0)
                          // Boxes with pre-existing transaction_no + box_id use Acknowledge (they already have QR stickers)
                          // Boxes without both fields need Print QR (generates new sticker + acknowledges)
                          const hasExistingQRData = !!(
                            (line.transaction_no || boxData.transaction_no) &&
                            (line.box_id || boxData.box_id)
                          )

                          return (
                            <Fragment key={index}>
                              <tr className={`${matched ? "bg-emerald-50/40" : issued ? "bg-red-50/30" : "hover:bg-gray-50/50"} transition-colors`}>
                                <td className="py-2.5 px-2 text-center text-gray-500 font-medium tabular-nums">{index + 1}</td>
                                <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[220px]">
                                  <span className="block truncate" title={line.item_desc_raw || line.item_description}>
                                    {line.item_desc_raw || line.item_description || `Article ${index + 1}`}
                                  </span>
                                </td>
                                {/* Transaction No — generated value takes priority, then source */}
                                <td className="py-2.5 px-3 font-mono text-xs truncate max-w-[130px]">
                                  {inwardTransactionNo
                                    ? <span className="text-violet-700 font-semibold">{inwardTransactionNo}</span>
                                    : <span className="text-gray-500">{scannedLineData[index]?.transaction_no || line.transaction_no || boxData.transaction_no || <span className="text-gray-300">—</span>}</span>
                                  }
                                </td>
                                {/* Box ID — generated value takes priority, then source */}
                                {(() => {
                                  const rec = lineReconciliationMap[index]
                                  const generatedId = generatedBoxIds[index]
                                  const sourceId = scannedLineData[index]?.box_id || line.box_id || boxData.box_id
                                  const displayId = generatedId || sourceId
                                  const showBadge = !generatedId && rec && (rec.status === "overridden" || rec.status === "overridden_no_source" || rec.status === "propagated")
                                  return (
                                    <td className="py-2.5 px-3 font-mono text-xs truncate max-w-[120px]">
                                      <span className="inline-flex items-center gap-1">
                                        {displayId
                                          ? <span className={generatedId ? "text-violet-700 font-semibold" : "text-gray-500"}>{displayId}</span>
                                          : <span className="text-gray-300">—</span>
                                        }
                                        {showBadge && (
                                          <span
                                            className="inline-flex items-center text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5"
                                            title={`Originally: ${rec.original_box_id || "—"} → Scanned: ${rec.actual_box_id || displayId}${rec.propagated_count ? ` · +${rec.propagated_count} siblings auto-mapped` : ""}`}
                                          >↻ Reconciled</span>
                                        )}
                                      </span>
                                    </td>
                                  )
                                })()}
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.case_pack ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.case_pack) || line.pack_size || "-"}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-blue-600 tabular-nums whitespace-nowrap">{line.qty || line.quantity || 0} <span className="text-gray-400 font-normal text-xs">{line.uom || ""}</span></td>
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.net_weight ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.net_weight) || lineWeights[index]?.net_weight || line.net_weight || "-"}</td>
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.total_weight ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.total_weight) || lineWeights[index]?.total_weight || line.total_weight || "-"}</td>
                                {hasBatchData && <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{line.batch_number || "-"}</td>}
                                <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{line.lot_number || "-"}</td>
                                <td className="py-2.5 px-3 sticky right-0 bg-inherit">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {!hasExistingQRData ? (
                                      /* No pre-existing QR data → Print QR (acknowledges + prints new sticker) */
                                      <>
                                        {matched && (
                                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeLine(index)}>
                                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                          </Badge>
                                        )}
                                        {issued && !matched && (
                                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Issue
                                          </Badge>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => handlePrintQR(index)} className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 h-7 px-3">
                                          <Printer className="h-3 w-3 mr-1" /> Print QR
                                        </Button>
                                        {!matched && !issued && (
                                          <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-3">
                                            <AlertTriangle className="h-3 w-3 mr-1" /> Issue
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      /* Pre-existing QR data (from cold storage scan) → Acknowledge only */
                                      <>
                                        {matched ? (
                                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeLine(index)}>
                                            <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                          </Badge>
                                        ) : issued ? (
                                          <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                                            <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Issue
                                          </Badge>
                                        ) : (
                                          <>
                                            <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3">
                                              Acknowledge
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-3">
                                              <AlertTriangle className="h-3 w-3 mr-1" /> Issue
                                            </Button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isIssueOpen && (
                                <tr>
                                  <td colSpan={totalCols} className="p-0">
                                    <div className="px-4 py-3 bg-red-50/30">
                                      <div className="border-2 border-red-200 rounded-lg bg-red-50/50 p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4 text-red-500" />
                                            <span className="text-sm font-semibold text-red-800">Report Issue — {line.item_desc_raw || line.item_description || `Article ${index + 1}`}</span>
                                          </div>
                                          <Button variant="ghost" size="sm" onClick={handleCancelIssue} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600">
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </div>
                                        <p className="text-xs text-red-600">
                                          Expected: Qty <span className="font-bold">{line.qty || line.quantity || 0} {line.uom || ""}</span>, Total Weight <span className="font-bold">{line.total_weight || "-"}</span>
                                        </p>
                                        <div className="grid grid-cols-3 gap-3">
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-red-700">Case Pack</Label>
                                            <Input type="number" step="any" value={issueForm.case_pack} onChange={(e) => setIssueForm(prev => ({ ...prev, case_pack: e.target.value }))} placeholder="e.g. 10" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-red-700">Net Weight</Label>
                                            <Input type="number" step="any" value={issueForm.net_weight} onChange={(e) => setIssueForm(prev => ({ ...prev, net_weight: e.target.value }))} placeholder="e.g. 500" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-red-700">Total Weight</Label>
                                            <Input type="number" step="any" value={issueForm.total_weight} onChange={(e) => setIssueForm(prev => ({ ...prev, total_weight: e.target.value }))} placeholder="e.g. 550" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs font-medium text-red-700">Remarks</Label>
                                            <Input type="text" value={issueForm.remarks} onChange={(e) => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))} placeholder="Damage, shortage, etc." className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                          </div>
                                        </div>
                                        {(() => {
                                          const itemNameForBulk = line.item_desc_raw || line.item_description || ""
                                          const pendingMatchCount = lines.filter((l: any, i: number) =>
                                            i !== index &&
                                            (l.item_desc_raw || l.item_description || "") === itemNameForBulk &&
                                            !linesMatchMap[i] && !linesIssueMap[i]
                                          ).length
                                          return pendingMatchCount > 0 ? (
                                            <label className="flex items-center gap-2 text-xs text-red-700 cursor-pointer select-none">
                                              <input
                                                type="checkbox"
                                                checked={applyToAllIssue}
                                                onChange={e => setApplyToAllIssue(e.target.checked)}
                                                className="rounded border-red-300 text-red-600 focus:ring-red-400"
                                              />
                                              Apply same correction to all {pendingMatchCount} other pending box{pendingMatchCount !== 1 ? 'es' : ''} of this item
                                            </label>
                                          ) : null
                                        })()}
                                        <div className="flex gap-2 justify-end">
                                          <Button variant="outline" size="sm" onClick={handleCancelIssue} className="h-8 px-3 text-xs text-gray-600 border-gray-300">Cancel</Button>
                                          <Button size="sm" onClick={() => handleSubmitIssue(index)} className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white">
                                            <AlertTriangle className="h-3 w-3 mr-1" /> Submit Issue{applyToAllIssue && (() => {
                                              const itemNameForBulk = line.item_desc_raw || line.item_description || ""
                                              const pendingMatchCount = lines.filter((l: any, i: number) =>
                                                i !== index &&
                                                (l.item_desc_raw || l.item_description || "") === itemNameForBulk &&
                                                !linesMatchMap[i] && !linesIssueMap[i]
                                              ).length
                                              return pendingMatchCount > 0 ? ` (${pendingMatchCount + 1})` : ""
                                            })()}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="md:hidden divide-y divide-gray-100">
                    {lines.map((line: any, index: number) => {
                      const matched = !!linesMatchMap[index]
                      const issued = !!linesIssueMap[index]
                      const isIssueOpen = issueOpenIndex === index
                      const mobileBoxData = lineBoxDataMap[line.id] || {}
                      const hasExistingQRData = !!(
                        (line.transaction_no || mobileBoxData.transaction_no) &&
                        (line.box_id || mobileBoxData.box_id)
                      )

                      return (
                        <div key={index} className={`px-3 py-3 ${matched ? "bg-emerald-50/40" : issued ? "bg-red-50/30" : ""}`}>
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate"><span className="text-gray-500 font-medium mr-1.5">{index + 1}.</span>{line.item_desc_raw || line.item_description || `Article ${index + 1}`}</span>
                              </div>
                              {!hasExistingQRData ? (
                                /* No pre-existing data → Print QR */
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                  {matched && (
                                    <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeLine(index)}>
                                      <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                    </Badge>
                                  )}
                                  {issued && !matched && (
                                    <Badge variant="outline" className="text-[11px] bg-red-50 text-red-600 border-red-200 shrink-0">
                                      <AlertTriangle className="h-3 w-3 mr-0.5" /> Issue
                                    </Badge>
                                  )}
                                  <Button variant="outline" size="sm" onClick={() => handlePrintQR(index)} className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 h-7 px-2">
                                    <Printer className="h-3 w-3 mr-1" /> QR
                                  </Button>
                                  {!matched && !issued && (
                                    <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-2">
                                      Issue
                                    </Button>
                                  )}
                                </div>
                              ) : matched ? (
                                /* Pre-existing data, acknowledged */
                                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeLine(index)}>
                                  <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                </Badge>
                              ) : issued ? (
                                <Badge variant="outline" className="text-[11px] bg-red-50 text-red-600 border-red-200 shrink-0">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Issue
                                </Badge>
                              ) : (
                                /* Pre-existing data, not yet processed → Acknowledge */
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2">
                                    Acknowledge
                                  </Button>
                                  <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-2">
                                    Issue
                                  </Button>
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs pl-1">
                              <div><span className="text-gray-500">Case Pack:</span> <span className={`font-medium ${issued && linesIssueMap[index]?.case_pack ? "text-red-600 font-bold" : ""}`}>{(issued && linesIssueMap[index]?.case_pack) || line.pack_size || "-"}</span></div>
                              <div><span className="text-gray-500">Qty:</span> <span className="font-bold text-blue-600">{line.qty || line.quantity || 0}</span> <span className="text-gray-500">{line.uom || ""}</span></div>
                              <div><span className="text-gray-500">Net Wt:</span> <span className={`font-medium ${issued && linesIssueMap[index]?.net_weight ? "text-red-600 font-bold" : ""}`}>{(issued && linesIssueMap[index]?.net_weight) || lineWeights[index]?.net_weight || line.net_weight || "-"}</span></div>
                              <div><span className="text-gray-500">Total Wt:</span> <span className={`font-medium ${issued && linesIssueMap[index]?.total_weight ? "text-red-600 font-bold" : ""}`}>{(issued && linesIssueMap[index]?.total_weight) || lineWeights[index]?.total_weight || line.total_weight || "-"}</span></div>
                              {isColdStorageFrom && <div><span className="text-gray-500">Trans No:</span> <span className="font-mono font-medium">{scannedLineData[index]?.transaction_no || line.transaction_no || mobileBoxData.transaction_no || "-"}</span></div>}
                              {isColdStorageFrom && <div><span className="text-gray-500">Box ID:</span> <span className="font-mono font-medium">{scannedLineData[index]?.box_id || line.box_id || mobileBoxData.box_id || "-"}</span></div>}
                              {line.batch_number && <div><span className="text-gray-500">Batch:</span> <span className="font-mono font-medium">{line.batch_number}</span></div>}
                              {line.lot_number && <div><span className="text-gray-500">Lot:</span> <span className="font-mono font-medium">{line.lot_number}</span></div>}
                            </div>
                            {/* Issue details on mobile */}
                            {issued && linesIssueMap[index] && (
                              <div className="mt-1.5 p-2 bg-red-50 border border-red-200 rounded text-xs space-y-0.5">
                                <p className="font-semibold text-red-700">Discrepancy Reported:</p>
                                <div className="grid grid-cols-3 gap-x-3 gap-y-0.5">
                                  {linesIssueMap[index].case_pack && <div><span className="text-red-500">Case Pack:</span> <span className="font-bold text-red-700">{linesIssueMap[index].case_pack}</span></div>}
                                  {linesIssueMap[index].net_weight && <div><span className="text-red-500">Net Wt:</span> <span className="font-bold text-red-700">{linesIssueMap[index].net_weight}</span></div>}
                                  {linesIssueMap[index].total_weight && <div><span className="text-red-500">Total Wt:</span> <span className="font-bold text-red-700">{linesIssueMap[index].total_weight}</span></div>}
                                </div>
                                {linesIssueMap[index].remarks && <p className="text-red-600">Remarks: {linesIssueMap[index].remarks}</p>}
                              </div>
                            )}
                          </div>

                          {/* ── Issue Form (expandable) ── */}
                          {isIssueOpen && (
                            <div className="mt-2">
                              <div className="border-2 border-red-200 rounded-lg bg-red-50/50 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                    <span className="text-sm font-semibold text-red-800">Report Issue</span>
                                  </div>
                                  <Button variant="ghost" size="sm" onClick={handleCancelIssue} className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600">
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-xs text-red-600">
                                  Expected: Qty <span className="font-bold">{line.qty || line.quantity || 0} {line.uom || ""}</span>, Total Weight <span className="font-bold">{line.total_weight || "-"}</span>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Case Pack</Label>
                                    <Input type="number" step="any" value={issueForm.case_pack} onChange={(e) => setIssueForm(prev => ({ ...prev, case_pack: e.target.value }))} placeholder="e.g. 10" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Net Weight</Label>
                                    <Input type="number" step="any" value={issueForm.net_weight} onChange={(e) => setIssueForm(prev => ({ ...prev, net_weight: e.target.value }))} placeholder="e.g. 500" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Total Weight</Label>
                                    <Input type="number" step="any" value={issueForm.total_weight} onChange={(e) => setIssueForm(prev => ({ ...prev, total_weight: e.target.value }))} placeholder="e.g. 550" className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs font-medium text-red-700">Remarks</Label>
                                    <Input type="text" value={issueForm.remarks} onChange={(e) => setIssueForm(prev => ({ ...prev, remarks: e.target.value }))} placeholder="Damage, shortage, etc." className="h-9 bg-white border-red-200 focus-visible:ring-red-300 text-sm" />
                                  </div>
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button variant="outline" size="sm" onClick={handleCancelIssue} className="h-8 px-3 text-xs text-gray-600 border-gray-300">Cancel</Button>
                                  <Button size="sm" onClick={() => handleSubmitIssue(index)} className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white">
                                    <AlertTriangle className="h-3 w-3 mr-1" /> Submit Issue
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* ── Per-article Box Range Reprint (shows once all boxes of that article are resolved) ── */}
                  {Object.entries(articleLineGroups).some(([artName, indices]) => {
                    const allArtResolved = indices.every(i => linesMatchMap[i] || linesIssueMap[i])
                    const hasQR = !!inwardTransactionNo || indices.some(i => (lines[i]?.transaction_no && lines[i]?.box_id) || generatedBoxIds[i])
                    return allArtResolved && hasQR
                  }) && (
                    <div className="border-t border-violet-100 mt-2 pt-3 px-4 pb-3 space-y-2">
                      <p className="text-[11px] font-semibold text-violet-600 uppercase tracking-wider">Box Range Reprint — per article</p>
                      {Object.entries(articleLineGroups).map(([artName, indices]) => {
                        const allArtResolved = indices.every(i => linesMatchMap[i] || linesIssueMap[i])
                        const hasQR = !!inwardTransactionNo || indices.some(i => (lines[i]?.transaction_no && lines[i]?.box_id) || generatedBoxIds[i])
                        if (!allArtResolved || !hasQR) return null
                        const isOpen = !!articleRangeOpen[artName]
                        const boxCount = indices.length
                        return (
                          <div key={artName} className="border border-violet-100 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setArticleRangeOpen(prev => ({ ...prev, [artName]: !prev[artName] }))}
                              className="w-full flex items-center justify-between px-3 py-2 bg-violet-50/60 hover:bg-violet-50 text-xs font-medium text-violet-800 transition-colors"
                            >
                              <span className="truncate max-w-[300px]">{artName}</span>
                              <span className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-violet-500">{boxCount} box{boxCount !== 1 ? "es" : ""}</span>
                                <ChevronDown className={`h-3.5 w-3.5 text-violet-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </span>
                            </button>
                            {isOpen && (
                              <div className="px-3 py-2.5 bg-white flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-500">Box range:</span>
                                <input
                                  type="number" min={1} max={boxCount}
                                  value={articleRangeFrom[artName] ?? 1}
                                  onChange={e => setArticleRangeFrom(prev => ({ ...prev, [artName]: Math.max(1, Math.min(boxCount, Number(e.target.value))) }))}
                                  className="w-16 h-7 text-xs text-center border rounded px-1"
                                />
                                <span className="text-xs text-gray-400">to</span>
                                <input
                                  type="number" min={1} max={boxCount}
                                  value={articleRangeTo[artName] ?? boxCount}
                                  onChange={e => setArticleRangeTo(prev => ({ ...prev, [artName]: Math.max(1, Math.min(boxCount, Number(e.target.value))) }))}
                                  className="w-16 h-7 text-xs text-center border rounded px-1"
                                />
                                <Button size="sm" variant="outline"
                                  onClick={() => handlePrintRange(artName)}
                                  className="h-7 px-3 text-xs text-violet-700 border-violet-200 hover:bg-violet-50"
                                >
                                  <Printer className="h-3 w-3 mr-1" />Print Range
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {totalItems === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="h-14 w-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">No boxes or articles in this transfer</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ Totals Summary ══════ */}
          {transferData && totalItems > 0 && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-3 sm:p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="text-center p-2.5 bg-blue-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Boxes</p>
                    <p className="text-lg sm:text-xl font-bold text-blue-700">{(linesAreBoxes || allLinesCoveredByBoxes) ? totalLines : totalBoxes + totalLines}</p>
                  </div>
                  <div className="text-center p-2.5 bg-indigo-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Qty</p>
                    <p className="text-lg sm:text-xl font-bold text-indigo-700">
                      {(() => {
                        const qty = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.qty || l.quantity || 0)), 0)
                          + ((linesAreBoxes || allLinesCoveredByBoxes) ? 0 : boxes.length)
                        return qty
                      })()}
                    </p>
                  </div>
                  <div className="text-center p-2.5 bg-emerald-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Net Wt</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700">
                      {(() => {
                        // `lines` holds every entry (scanned + manual), so summing it avoids
                        // both double-counting scanned boxes and dropping manual entries.
                        const total = lines.reduce((sum: number, l: any, i: number) =>
                          sum + (parseFloat(lineWeights[i]?.net_weight || l.net_weight) || 0), 0)
                        return `${total.toFixed(2)} kg`
                      })()}
                    </p>
                  </div>
                  <div className="text-center p-2.5 bg-amber-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Gross Wt</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-700">
                      {(() => {
                        const total = lines.reduce((sum: number, l: any, i: number) =>
                          sum + (parseFloat(lineWeights[i]?.total_weight || l.total_weight) || 0), 0)
                        return `${total.toFixed(2)} kg`
                      })()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ══════ Condition Assessment ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Condition Assessment</CardTitle>
            </CardHeader>
            <CardContent className="p-3 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="boxCondition" className="text-xs font-medium text-gray-600">Box Condition</Label>
                  <Select value={boxCondition} onValueChange={setBoxCondition}>
                    <SelectTrigger id="boxCondition" className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Damaged">Damaged</SelectItem>
                      <SelectItem value="Partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conditionRemarks" className="text-xs font-medium text-gray-600">
                    Remarks <span className="text-gray-400 font-normal">(Optional)</span>
                  </Label>
                  <Textarea
                    id="conditionRemarks"
                    value={conditionRemarks}
                    onChange={(e) => setConditionRemarks(e.target.value)}
                    placeholder="Enter any remarks..."
                    className="min-h-[38px] resize-none bg-white border-gray-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ══════ STBR Reconciliation Summary (only shown if any swaps happened) ══════ */}
          {(() => {
            const boxRecs = Object.values(boxReconciliationMap)
            const lineRecs = Object.values(lineReconciliationMap)
            const all = [...boxRecs, ...lineRecs]
            const overrideCount = all.filter(r => r.status === "overridden" || r.status === "overridden_no_source").length
            const propagatedCount = all.filter(r => r.status === "propagated").length
            const totalPropagated = all.reduce((sum, r) => sum + (r.propagated_count || 0), 0)
            const totalSwaps = overrideCount + propagatedCount + totalPropagated
            if (totalSwaps === 0) return null
            return (
              <Card className="border-0 shadow-sm overflow-hidden mb-3 border-l-4 border-l-amber-400">
                <CardContent className="p-3 sm:p-4 bg-amber-50/30">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-700 text-base mt-0.5">↻</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-amber-900">
                        STBR Reconciliation Summary — {totalSwaps} box-id swap{totalSwaps !== 1 ? "s" : ""} applied
                      </div>
                      <div className="text-[11px] text-amber-800 mt-1 leading-snug">
                        {overrideCount > 0 && <>Scan-time overrides: <span className="font-semibold">{overrideCount}</span> · </>}
                        {propagatedCount > 0 && <>Series propagations: <span className="font-semibold">{propagatedCount}</span> · </>}
                        {totalPropagated > 0 && <>Siblings auto-mapped: <span className="font-semibold">{totalPropagated}</span></>}
                      </div>
                      <div className="text-[10px] text-amber-700 mt-1">
                        Hover any <span className="inline-flex items-center text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 mx-0.5">↻ Reconciled</span> badge above to see Originally → Scanned. Full audit on finalize via /transfer-in/{pendingHeaderId}/reconciliation.
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })()}

          {/* ══════ Confirm Receipt ══════ */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-3 sm:p-5">
              <Button
                onClick={handleConfirmReceipt}
                disabled={loading || totalItems === 0 || !allMatched}
                className={`w-full h-12 font-semibold text-sm sm:text-base transition-all ${
                  allMatched
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Confirming...</>
                ) : totalItems === 0 ? (
                  "No Items to Confirm"
                ) : !allMatched ? (
                  <span className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Acknowledge All Items to Continue ({totalMatched}/{totalItems})
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    Confirm Receipt — All Items Acknowledged
                  </span>
                )}
              </Button>
              {pendingHeaderId && totalItems > 0 && totalMatched > 0 && !allMatched && (
                <Button
                  variant="outline"
                  onClick={() => setShortageDialogOpen(true)}
                  disabled={loading}
                  className="w-full h-10 mt-2 gap-2 text-xs sm:text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
                  title="Receive the acknowledged boxes and write off the rest as a shortage"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Close with shortage — write off {totalItems - totalMatched} unreceived
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ══════ Close-with-shortage confirm dialog ══════ */}
          <Dialog open={shortageDialogOpen} onOpenChange={(o) => { if (!closingShortage) setShortageDialogOpen(o) }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-5 w-5" /> Close with shortage
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  This receives the <span className="font-semibold text-gray-800">{totalMatched}</span> acknowledged item(s)
                  and <span className="font-semibold text-amber-700">writes off {totalItems - totalMatched}</span> unreceived box(es).
                  Both the transfer-in and transfer-out are then marked <span className="font-semibold">Received</span>.
                  Use this only when the missing boxes are genuinely not coming.
                </p>
                <div>
                  <label className="text-xs font-medium text-gray-600">Shortage reason (optional)</label>
                  <Input
                    value={shortageReason}
                    onChange={(e) => setShortageReason(e.target.value)}
                    placeholder="e.g. damaged in transit, miscount at source"
                    className="mt-1 h-9"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setShortageDialogOpen(false)} disabled={closingShortage}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                    onClick={handleCloseWithShortage}
                    disabled={closingShortage}
                  >
                    {closingShortage ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                    Close & write off {totalItems - totalMatched}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Empty State */}
      {!transferData && !loading && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                <Inbox className="h-7 w-7 text-teal-400" />
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1">No Transfer Loaded</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Enter a transfer number above or scan a QR code to get started
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && !transferData && (
        <div className="space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-white shadow-sm">
              <div className="h-10 w-10 rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-2.5 bg-gray-200 rounded w-1/2" />
              </div>
              <div className="h-6 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Privileged "Edit Receipt" dialog (gated to b.hrithik server-side) ──
// Loads the transfer-in (header + boxes) for the transfer-out, lets the fields be
// edited, and on Save calls the edit endpoint which syncs receipt + source
// transfer-out boxes + destination cold stock.
function EditReceiptDialog({ open, transferOutId, userEmail, onClose, onSaved }: {
  open: boolean
  transferOutId: number | null
  userEmail: string
  onClose: () => void
  onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hdr, setHdr] = useState<any>(null)
  const [boxes, setBoxes] = useState<any[]>([])

  useEffect(() => {
    if (!open || !transferOutId) return
    let cancelled = false
    setLoading(true); setHdr(null); setBoxes([])
    InterunitApiService.getTransferInByTransferOut(transferOutId)
      .then((res: any) => {
        if (cancelled) return
        const h = res?.header
        if (!h) { toast.error("No transfer-in found to edit"); onClose(); return }
        setHdr({
          grn_number: h.grn_number || "",
          receiving_warehouse: h.receiving_warehouse || "",
          box_condition: h.box_condition || "",
          condition_remarks: h.condition_remarks || "",
          status: h.status,
        })
        setBoxes((h.boxes || []).map((b: any) => ({
          box_id: b.box_id,
          article: b.article || "",
          lot_number: b.lot_number || "",
          net_weight: b.net_weight ?? "",
          gross_weight: b.gross_weight ?? "",
        })))
      })
      .catch((e: any) => { if (!cancelled) { toast.error(e?.message || "Failed to load receipt"); onClose() } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, transferOutId])

  const setBox = (i: number, field: string, val: string) =>
    setBoxes((prev) => prev.map((b, idx) => (idx === i ? { ...b, [field]: val } : b)))

  const handleSave = async () => {
    if (!transferOutId || !hdr) return
    setSaving(true)
    try {
      // Parse a weight input → finite number, or null to mean "leave unchanged".
      // Guards blank/whitespace/non-numeric (Number(" ")===0 would zero the weight).
      const num = (v: any): number | null => {
        const s = String(v ?? "").trim()
        if (s === "") return null
        const n = Number(s)
        return Number.isFinite(n) ? n : null
      }
      // Send only changed/non-empty values; the backend COALESCEs nulls to "leave
      // unchanged", so omitting a field never blanks it.
      const payload = {
        grn_number: hdr.grn_number || undefined,
        receiving_warehouse: hdr.receiving_warehouse || undefined,
        box_condition: hdr.box_condition || undefined,
        condition_remarks: hdr.condition_remarks || undefined,
        boxes: boxes.map((b) => ({
          box_id: b.box_id,
          article: b.article || undefined,
          lot_number: b.lot_number || undefined,
          net_weight: num(b.net_weight),
          gross_weight: num(b.gross_weight),
        })),
      }
      await InterunitApiService.editTransferIn(transferOutId, payload, userEmail)
      toast.success("Receipt updated — synced to source transfer & destination stock.")
      onSaved()
      onClose()
    } catch (e: any) {
      toast.error(e?.message || "Failed to save edits")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Receipt</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
        ) : hdr ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">GRN No</Label><Input value={hdr.grn_number} onChange={(e) => setHdr({ ...hdr, grn_number: e.target.value })} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Receiving Warehouse</Label><Input value={hdr.receiving_warehouse} onChange={(e) => setHdr({ ...hdr, receiving_warehouse: e.target.value })} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Box Condition</Label><Input value={hdr.box_condition} onChange={(e) => setHdr({ ...hdr, box_condition: e.target.value })} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Condition Remarks</Label><Input value={hdr.condition_remarks} onChange={(e) => setHdr({ ...hdr, condition_remarks: e.target.value })} className="h-8 text-xs" /></div>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b bg-muted/50">
                  <th className="text-left px-2 py-1.5 font-medium">Box</th>
                  <th className="text-left px-2 py-1.5 font-medium">Article</th>
                  <th className="text-left px-2 py-1.5 font-medium">Lot No</th>
                  <th className="text-right px-2 py-1.5 font-medium">Net Wt</th>
                  <th className="text-right px-2 py-1.5 font-medium">Gross Wt</th>
                </tr></thead>
                <tbody>
                  {boxes.map((b, i) => (
                    <tr key={b.box_id || i} className="border-b last:border-0">
                      <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{b.box_id}</td>
                      <td className="px-2 py-1"><Input value={b.article} onChange={(e) => setBox(i, "article", e.target.value)} className="h-7 text-xs" /></td>
                      <td className="px-2 py-1"><Input value={b.lot_number} onChange={(e) => setBox(i, "lot_number", e.target.value)} className="h-7 text-xs" /></td>
                      <td className="px-2 py-1"><Input type="number" step="any" value={b.net_weight} onChange={(e) => setBox(i, "net_weight", e.target.value)} className="h-7 text-xs text-right" /></td>
                      <td className="px-2 py-1"><Input type="number" step="any" value={b.gross_weight} onChange={(e) => setBox(i, "gross_weight", e.target.value)} className="h-7 text-xs text-right" /></td>
                    </tr>
                  ))}
                  {boxes.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">No boxes on this receipt.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">Saving updates the receipt, the source transfer-out boxes, and the destination cold-storage stock.</p>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</> : "Save changes"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
