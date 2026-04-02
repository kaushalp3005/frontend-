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
import {
  Loader2, Package, Search, Camera, ArrowLeft, ArrowRight, Inbox,
  CheckCircle, ClipboardCheck, CheckCheck, Hash, FileText,
  AlertTriangle, X, Building2, Snowflake, Printer
} from "lucide-react"
import { toast } from "sonner"
import { InterunitApiService } from "@/lib/interunitApiService"
import { ColdStorageApiService } from "@/lib/api/coldStorageApiService"
import { useAuthStore } from "@/lib/stores/auth"

import QRCode from "qrcode"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import type { Company } from "@/types/auth"

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
  const [boxCondition, setBoxCondition] = useState("Good")
  const [conditionRemarks, setConditionRemarks] = useState("")
  const [showAckScanner, setShowAckScanner] = useState(false)
  const [scanResult, setScanResult] = useState<{ type: "match" | "no-match" | "already" | "error"; message: string } | null>(null)

  // ── Cold storage per-item details (Savla / Rishi) — keyed by unique item name ──
  const [coldStorageItems, setColdStorageItems] = useState<Record<string, {
    inward_dt: string; vakkal: string; lot_no: string; rate: string; exporter: string;
    storage_location: string; item_mark: string; group_name: string; item_subgroup: string; cold_company: string; spl_remarks: string;
  }>>({})

  // ── Pending transfer-in state (real-time acknowledge) ──
  const [pendingHeaderId, setPendingHeaderId] = useState<number | null>(null)
  const [pendingGrnNumber, setPendingGrnNumber] = useState<string>("")

  // ── Editable line weights (keyed by line index) ──
  const [lineWeights, setLineWeights] = useState<Record<number, { net_weight: string; total_weight: string }>>({})

  const updateLineWeight = (index: number, field: "net_weight" | "total_weight", value: string) => {
    setLineWeights(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value },
    }))
  }

  // Helper: get cold storage lot_no for an article name (from Cold Storage Details form)
  const getColdLotNo = (articleName: string) => {
    const ci = coldStorageItems[articleName]
    return ci?.lot_no?.trim() || null
  }

  // ── Derived state ──
  const boxes = transferData?.boxes || []
  // Filter out lines that already have corresponding scanned boxes
  const rawLines = transferData?.lines || []
  const boxLineIds = new Set((transferData?.boxes || []).map((b: any) => b.transfer_line_id).filter(Boolean))
  // If boxes count covers all lines, show lines only (Article Entries has richer features: Print QR, editable weights)
  // Otherwise, filter out lines that already have a matching box by transfer_line_id
  const allLinesCoveredByBoxes = boxes.length > 0 && boxes.length >= rawLines.length
  const lines = allLinesCoveredByBoxes
    ? rawLines
    : rawLines.filter((l: any) => !boxLineIds.has(l.id))
  const totalBoxes = boxes.length
  const totalLines = lines.length
  const hasBatchData = lines.some((l: any) => l.batch_number)
  // When boxes cover all lines, only Article Entries section is shown (boxes section hidden)
  // So total count should only include lines, not both
  const totalItems = allLinesCoveredByBoxes ? totalLines : totalBoxes + totalLines
  const matchedBoxes = boxes.filter((b: any) => boxesMatchMap[b.id]).length
  const matchedLines = lines.filter((_: any, i: number) => linesMatchMap[i]).length
  const issuedLines = lines.filter((_: any, i: number) => linesIssueMap[i]).length
  const resolvedLines = matchedLines + issuedLines
  const totalMatched = allLinesCoveredByBoxes ? resolvedLines : matchedBoxes + resolvedLines
  const allMatched = totalItems > 0 && totalMatched === totalItems

  // ── Cold storage check ──
  const COLD_STORAGE_WAREHOUSES = ["Cold Storage", "Rishi cold", "Savla D-39 cold", "Savla D-514 cold"]
  const fromWarehouse = transferData?.from_warehouse || transferData?.from_site || ""
  const toWarehouse = transferData?.to_warehouse || transferData?.to_site || ""
  const isColdStorageFrom = COLD_STORAGE_WAREHOUSES.some(w => w.toLowerCase() === fromWarehouse.toLowerCase())
  const isColdStorageTransfer = COLD_STORAGE_WAREHOUSES.some(w => w.toLowerCase() === toWarehouse.toLowerCase())

  // ── Map line IDs to box data (for transaction_no / box_id from cold storage) ──
  const lineBoxDataMap = useMemo(() => {
    if (!transferData?.boxes) {
      console.log('⚠️ [DEBUG-IN] No boxes in transferData')
      return {}
    }

    console.log('📦 [DEBUG-IN] Building lineBoxDataMap from boxes:', {
      totalBoxes: transferData.boxes.length,
      boxes: transferData.boxes.map((b: any) => ({
        id: b.id,
        box_id: b.box_id,
        transaction_no: b.transaction_no,
        transfer_line_id: b.transfer_line_id,
        article: b.article
      }))
    })

    const map: Record<number, { box_id: string; transaction_no: string }> = {}
    const lines = transferData.lines || []
    const boxes = transferData.boxes as any[]

    // Primary: map by transfer_line_id (works when each box points to a unique line)
    boxes.forEach((b: any) => {
      if (b.transfer_line_id && !map[b.transfer_line_id]) {
        map[b.transfer_line_id] = {
          box_id: b.box_id || "",
          transaction_no: b.transaction_no || "",
        }
      }
    })

    // Fallback: if lines and boxes have 1:1 count but most lines have no mapping,
    // map by index position (handles case where all boxes share same transfer_line_id)
    if (lines.length > 0 && lines.length === boxes.length) {
      const unmappedLines = lines.filter((l: any) => !map[l.id])
      if (unmappedLines.length > lines.length / 2) {
        lines.forEach((l: any, i: number) => {
          if (!map[l.id] && boxes[i]) {
            map[l.id] = {
              box_id: boxes[i].box_id || "",
              transaction_no: boxes[i].transaction_no || "",
            }
          }
        })
      }
    }

    console.log('🗺️ [DEBUG-IN] lineBoxDataMap created:', map)
    return map
  }, [transferData])

  // Helper: update a single cold storage item field (keyed by item name)
  const updateColdItem = (itemKey: string, field: string, value: string) => {
    setColdStorageItems(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], [field]: value },
    }))
  }

  // All lines for cold storage (unfiltered - every transfer line)
  const allLines = transferData?.lines || []

  // Unique items for cold storage — group lines by item name, aggregate qty/weight
  const uniqueColdItems = useMemo(() => {
    if (!transferData?.lines) return []
    const itemMap: Record<string, { name: string; totalQty: number; totalWeight: number; uom: string; packSize: string; lines: any[] }> = {}
    ;(transferData.lines as any[]).forEach((line: any) => {
      const name = line.item_desc_raw || line.item_description || "Unknown Item"
      if (!itemMap[name]) {
        itemMap[name] = { name, totalQty: 0, totalWeight: 0, uom: line.uom || "", packSize: line.pack_size || "", lines: [] }
      }
      itemMap[name].totalQty += parseFloat(line.qty || line.quantity || 0)
      itemMap[name].totalWeight += parseFloat(line.net_weight || line.total_weight || 0)
      itemMap[name].lines.push(line)
    })
    return Object.values(itemMap)
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

      console.log('📥 [DEBUG-IN] Transfer data loaded:', {
        transfer_no: response.challan_no || response.transfer_no,
        from_warehouse: response.from_warehouse || response.from_site,
        to_warehouse: response.to_warehouse || response.to_site,
        lines_count: response.lines?.length || 0,
        boxes_count: response.boxes?.length || 0,
        boxes_sample: response.boxes?.slice(0, 3).map((b: any) => ({
          box_id: b.box_id,
          transaction_no: b.transaction_no,
          transfer_line_id: b.transfer_line_id
        })) || []
      })

      console.log('🏢 [DEBUG-IN] Warehouse check:', {
        from_warehouse: response.from_warehouse || response.from_site,
        isColdStorageFrom: COLD_STORAGE_WAREHOUSES.some(w =>
          w.toLowerCase() === (response.from_warehouse || response.from_site || "").toLowerCase()
        ),
        expected_cold_warehouses: COLD_STORAGE_WAREHOUSES
      })

      setTransferData(response)

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

      // Init cold storage item map — keyed by unique item name
      const today = new Date().toISOString().split("T")[0]
      const coldMap: Record<string, any> = {}
      const seenItems = new Set<string>()
      ;(response.lines || []).forEach((line: any) => {
        const name = line.item_desc_raw || line.item_description || "Unknown Item"
        if (!seenItems.has(name)) {
          seenItems.add(name)
          coldMap[name] = {
            inward_dt: today, vakkal: "", lot_no: "", rate: "",
            exporter: "", storage_location: toWarehouse, item_mark: "",
            group_name: line.item_category || "",
            item_subgroup: line.sub_category || "",
            cold_company: (company || "cfpl").toLowerCase(), spl_remarks: "",
          }
        }
      })
      setColdStorageItems(coldMap)

      // Auto-fetch extra details for each unique item
      for (const itemName of Object.keys(coldMap)) {
        // 1. Fetch from cold storage (item_mark, exporter)
        try {
          const csResult = await ColdStorageApiService.searchColdStorageStocks({
            company: (company || "cfpl").toLowerCase(),
            item_description: itemName,
            limit: "1",
          })
          if (csResult.results?.length > 0) {
            const csRecord = csResult.results[0]
            setColdStorageItems(prev => ({
              ...prev,
              [itemName]: {
                ...prev[itemName],
                group_name: prev[itemName]?.group_name || csRecord.group_name || "",
                item_mark: csRecord.item_mark || prev[itemName]?.item_mark || "",
                exporter: csRecord.exporter || prev[itemName]?.exporter || "",
              }
            }))
          }
        } catch (e) {
          console.warn(`Could not fetch cold storage data for ${itemName}:`, e)
        }

        // 2. Fetch group/sub_group from categorial_inv if still missing
        if (!coldMap[itemName].group_name || !coldMap[itemName].item_subgroup) {
          try {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/categorial-search?search=${encodeURIComponent(itemName)}&limit=1`
            const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
            if (res.ok) {
              const catData = await res.json()
              const match = catData.items?.find((i: any) => i.item_description?.toUpperCase() === itemName.toUpperCase())
              if (match) {
                setColdStorageItems(prev => ({
                  ...prev,
                  [itemName]: {
                    ...prev[itemName],
                    group_name: prev[itemName]?.group_name || match.group || "",
                    item_subgroup: prev[itemName]?.item_subgroup || match.sub_group || "",
                  }
                }))
              }
            }
          } catch (e) {
            console.warn(`Could not fetch categorial data for ${itemName}:`, e)
          }
        }
      }

      const boxCount = (response.boxes || []).length
      const lineCount = (response.lines || []).length
      toast.success(`Transfer ${response.transfer_no || response.challan_no} loaded with ${boxCount} boxes and ${lineCount} article lines`)

      // Check for existing pending transfer-in (resume flow)
      try {
        const pendingResult = await InterunitApiService.getPendingByTransferOut(response.id)
        if (pendingResult.exists && pendingResult.header) {
          setPendingHeaderId(pendingResult.header.id)
          setPendingGrnNumber(pendingResult.header.grn_number)

          // Restore acknowledged/issue state from saved boxes
          const savedBoxes = pendingResult.header.boxes || []
          const restoredLineMap: Record<number, boolean> = {}
          const restoredIssueMap: Record<number, { remarks: string; net_weight?: string; total_weight?: string; case_pack?: string }> = {}
          const restoredBoxMap: Record<number, boolean> = {}

          savedBoxes.forEach((sb: any) => {
            if (sb.line_index !== null && sb.line_index !== undefined) {
              if (sb.is_matched) {
                restoredLineMap[sb.line_index] = true
              } else if (sb.issue) {
                const issueData = typeof sb.issue === "string" ? JSON.parse(sb.issue) : sb.issue
                restoredIssueMap[sb.line_index] = {
                  remarks: issueData.remarks || "",
                  net_weight: issueData.net_weight || undefined,
                  total_weight: issueData.total_weight || undefined,
                  case_pack: issueData.case_pack || undefined,
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
  const handleAcknowledgeBox = async (boxId: number) => {
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    const box = boxes.find((b: any) => b.id === boxId)
    if (!box) return

    try {
      await InterunitApiService.acknowledgeBox(headerId, {
        box_id: String(box.box_id || box.box_number || box.id || ""),
        transfer_out_box_id: box.id,
        article: box.article ? String(box.article) : null,
        batch_number: box.batch_number ? String(box.batch_number) : null,
        lot_number: box.lot_number ? String(box.lot_number) : null,
        transaction_no: box.transaction_no ? String(box.transaction_no) : null,
        net_weight: box.net_weight ? Number(box.net_weight) : null,
        gross_weight: box.gross_weight ? Number(box.gross_weight) : null,
        is_matched: true,
      })
      setBoxesMatchMap((prev) => ({ ...prev, [boxId]: true }))
      toast.success(`Box #${boxId} acknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to acknowledge box")
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
        lot_number: b.lot_number ? String(b.lot_number) : null,
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
  const handleAcknowledgeLine = async (lineIndex: number) => {
    const line = lines[lineIndex]
    const headerId = await ensurePendingHeader()
    if (!headerId) return

    try {
      const w = lineWeights[lineIndex] || {}
      const boxRef = lineBoxDataMap[line.id] || {}
      const articleName = line.item_desc_raw || line.item_description || ""
      await InterunitApiService.acknowledgeBox(headerId, {
        box_id: line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`,
        article: articleName,
        batch_number: line.batch_number || null,
        lot_number: getColdLotNo(articleName) || line.lot_number || null,
        transaction_no: line.transaction_no || boxRef.transaction_no || null,
        net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
        gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
        is_matched: true,
        line_index: lineIndex,
      })
      setLinesMatchMap((prev) => ({ ...prev, [lineIndex]: true }))
      toast.success(`${articleName || "Line " + (lineIndex + 1)} acknowledged`)
    } catch (err: any) {
      toast.error(err.message || "Failed to save acknowledgment")
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
    const boxId = line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`

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
    const boxRef = lineBoxDataMap[line.id] || {}
    const issueNetWt = issueForm.net_weight.trim()
    const issueTotalWt = issueForm.total_weight.trim()
    const issueCasePack = issueForm.case_pack.trim()

    const issueData = {
      remarks: issueForm.remarks.trim(),
      net_weight: issueNetWt || undefined,
      total_weight: issueTotalWt || undefined,
      case_pack: issueCasePack || undefined,
    }

    // Update lineWeights from issue form values
    if (issueNetWt || issueTotalWt) {
      setLineWeights(prev => ({
        ...prev,
        [lineIndex]: {
          net_weight: issueNetWt || prev[lineIndex]?.net_weight || "",
          total_weight: issueTotalWt || prev[lineIndex]?.total_weight || "",
        },
      }))
    }

    try {
      const articleName = line.item_desc_raw || line.item_description || ""
      await InterunitApiService.acknowledgeBox(headerId, {
        box_id: line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`,
        article: articleName,
        batch_number: line.batch_number || null,
        lot_number: getColdLotNo(articleName) || line.lot_number || null,
        transaction_no: line.transaction_no || boxRef.transaction_no || null,
        net_weight: issueNetWt ? Number(issueNetWt) : (line.net_weight ? Number(line.net_weight) : null),
        gross_weight: issueTotalWt ? Number(issueTotalWt) : (line.total_weight ? Number(line.total_weight) : null),
        is_matched: false,
        issue: issueData,
        line_index: lineIndex,
      })

      setLinesIssueMap((prev) => ({ ...prev, [lineIndex]: issueData }))
      setLinesMatchMap((prev) => {
        const next = { ...prev }
        delete next[lineIndex]
        return next
      })
      setIssueOpenIndex(null)
      setIssueForm({ remarks: "", net_weight: "", total_weight: "", case_pack: "" })
      toast.success(`Discrepancy noted for ${line?.item_desc_raw || "Line " + (lineIndex + 1)}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to save issue")
    }
  }

  const handleCancelIssue = () => {
    setIssueOpenIndex(null)
    setIssueForm({ remarks: "", net_weight: "", total_weight: "", case_pack: "" })
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
          box_id: line.box_id || boxRef.box_id || `ART-${i + 1}`,
          article: articleName,
          batch_number: line.batch_number || null,
          lot_number: getColdLotNo(articleName) || line.lot_number || null,
          transaction_no: line.transaction_no || boxRef.transaction_no || null,
          net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
          gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
          is_matched: true,
          line_index: i,
        })
      }
    })

    boxes.forEach((b: any) => {
      if (!boxesMatchMap[b.id]) {
        batchItems.push({
          box_id: String(b.box_id || b.box_number || b.id || ""),
          transfer_out_box_id: b.id,
          article: b.article ? String(b.article) : null,
          batch_number: b.batch_number ? String(b.batch_number) : null,
          lot_number: b.lot_number ? String(b.lot_number) : null,
          transaction_no: b.transaction_no ? String(b.transaction_no) : null,
          net_weight: b.net_weight ? Number(b.net_weight) : null,
          gross_weight: b.gross_weight ? Number(b.gross_weight) : null,
          is_matched: true,
        })
      }
    })

    if (batchItems.length === 0) {
      toast.success("All items already acknowledged")
      return
    }

    try {
      await InterunitApiService.acknowledgeBatch(headerId, batchItems)

      const newBoxMap = { ...boxesMatchMap }
      boxes.forEach((b: any) => { newBoxMap[b.id] = true })
      setBoxesMatchMap(newBoxMap)

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
          box_id: line.box_id || boxRef.box_id || `ART-${i + 1}`,
          article: articleName,
          batch_number: line.batch_number || null,
          lot_number: getColdLotNo(articleName) || line.lot_number || null,
          transaction_no: line.transaction_no || boxRef.transaction_no || null,
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
        lot_number: b.lot_number ? String(b.lot_number) : null,
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

      // When boxes cover all lines, the UI shows lines (not boxes).
      // So we must acknowledge the corresponding LINE for the count to update.
      if (allLinesCoveredByBoxes) {
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
          await handleAcknowledgeLine(lineIdx)
          setScanResult({ type: "match", message: `Matched — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
          return
        }
      }

      // Normal flow: acknowledge the box directly
      if (boxesMatchMap[matchedBox.id]) {
        setScanResult({ type: "already", message: `Already Acknowledged — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
        return
      }
      await handleAcknowledgeBox(matchedBox.id)
      setScanResult({ type: "match", message: `Matched — ${article} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
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
      await handleAcknowledgeLine(matchedLineIndex)
      setScanResult({ type: "match", message: `Matched — ${articleName} | Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
      return
    }

    setScanResult({ type: "no-match", message: `Not Matched — Box ID: ${scannedBoxId || "N/A"} | Transaction: ${scannedTransactionNo || "N/A"}` })
  }

  // ── Print QR & auto-acknowledge (for cold storage FROM transfers) ──
  const handlePrintQR = useCallback(async (lineIndex: number) => {
    const line = lines[lineIndex]
    if (!line) return

    // Auto-acknowledge via API — only update local state if API succeeds
    const headerId = await ensurePendingHeader()
    if (headerId) {
      try {
        const w = lineWeights[lineIndex] || {}
        const boxRef = lineBoxDataMap[line.id] || {}
        const articleName = line.item_desc_raw || line.item_description || ""
        await InterunitApiService.acknowledgeBox(headerId, {
          box_id: line.box_id || boxRef.box_id || `ART-${lineIndex + 1}`,
          article: articleName,
          batch_number: line.batch_number || null,
          lot_number: getColdLotNo(articleName) || line.lot_number || null,
          transaction_no: line.transaction_no || boxRef.transaction_no || null,
          net_weight: w.net_weight ? Number(w.net_weight) : (line.net_weight ? Number(line.net_weight) : null),
          gross_weight: w.total_weight ? Number(w.total_weight) : (line.total_weight ? Number(line.total_weight) : null),
          is_matched: true,
          line_index: lineIndex,
        })
        setLinesMatchMap(prev => ({ ...prev, [lineIndex]: true }))
      } catch (err: any) {
        console.warn("Failed to persist QR acknowledge:", err)
        toast.error("QR printed but failed to save acknowledgment to server")
        return // Don't print QR if acknowledge failed
      }
    } else {
      toast.error("Could not create pending transfer. QR not printed.")
      return // Don't print QR if no pending header
    }

    const boxData = lineBoxDataMap[line.id] || {}
    const weights = lineWeights[lineIndex] || {}
    const netWt = parseFloat(weights.net_weight || line.net_weight || "0")
    const grossWt = parseFloat(weights.total_weight || line.total_weight || "0")
    const itemName = line.item_desc_raw || line.item_description || `Article ${lineIndex + 1}`
    const txNo = line.transaction_no || boxData.transaction_no || ""
    const bId = line.box_id || boxData.box_id || ""
    const lotNo = line.lot_number || ""
    const transferNo = transferData?.challan_no || transferData?.transfer_no || ""
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
      </style></head><body>
        <div class="label">
          <div class="qr"><img src="${qrCodeDataURL}" /></div>
          <div class="info">
            <div>
              <div class="company">${company}</div>
              <div class="txn">${transferNo}</div>
              <div class="boxid">ID: ${bId}</div>
            </div>
            <div class="item">${itemName}</div>
            <div>
              <div class="detail"><b>Box #${boxNum}</b> &nbsp; Net: ${netWt}kg &nbsp; Gross: ${grossWt}kg</div>
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
  }, [lines, lineBoxDataMap, lineWeights, transferData, company, toast])

  const handleConfirmReceipt = async () => {
    if (!transferData) return

    try {
      setLoading(true)

      // Helper: build cold storage payload
      const buildColdStoragePayload = () => {
        if (!isColdStorageTransfer) return undefined
        return uniqueColdItems.map((item) => {
          const ci = coldStorageItems[item.name] || {}
          const itemRate = parseFloat(ci.rate || "0")

          const itemBoxes = boxes
            .filter((b: any) => (b.article || "") === item.name)
            .map((b: any) => ({
              box_id: b.box_id || null,
              transaction_no: b.transaction_no || null,
              weight_kg: b.net_weight ? Number(b.net_weight) : null,
            }))

          const itemLineBoxes = itemBoxes.length > 0 ? itemBoxes : item.lines.map((l: any, i: number) => {
            const bData = lineBoxDataMap[l.id] || {}
            // Use rawLines index since item.lines comes from transferData.lines (unfiltered)
            const rawIdx = rawLines.indexOf(l)
            const lineIdx = rawIdx >= 0 ? rawIdx : lines.indexOf(l)
            const w = lineIdx >= 0 ? (lineWeights[lineIdx] || {}) : {}
            return {
              box_id: l.box_id || bData.box_id || null,
              transaction_no: l.transaction_no || bData.transaction_no || null,
              weight_kg: w.net_weight ? Number(w.net_weight) : (l.net_weight ? Number(l.net_weight) : null),
            }
          })

          return {
            cold_company: ci.cold_company || company || "cfpl",
            item_description: item.name,
            inward_dt: ci.inward_dt || null,
            vakkal: ci.vakkal?.trim() || null,
            lot_no: ci.lot_no?.trim() || null,
            item_mark: ci.item_mark?.trim() || null,
            group_name: ci.group_name?.trim() || null,
            item_subgroup: ci.item_subgroup?.trim() || null,
            storage_location: ci.storage_location?.trim() || null,
            exporter: ci.exporter?.trim() || null,
            no_of_cartons: item.totalQty || null,
            weight_kg: item.totalWeight || null,
            rate: itemRate || null,
            value: itemRate > 0 ? item.totalQty * itemRate : null,
            unit: item.uom || null,
            spl_remarks: ci.spl_remarks?.trim() || null,
            box_details: itemLineBoxes,
          }
        })
      }

      if (pendingHeaderId) {
        // ── Finalize pending transfer-in (boxes already in DB from real-time acknowledges) ──
        const finalizePayload: any = {
          box_condition: boxCondition,
          condition_remarks: conditionRemarks.trim() || null,
        }
        const coldItems = buildColdStoragePayload()
        if (coldItems) finalizePayload.cold_storage_items = coldItems

        await InterunitApiService.finalizeTransferIn(pendingHeaderId, finalizePayload)

        toast.success(`GRN ${pendingGrnNumber} finalized successfully.`)
      } else {
        // ── Fallback: original bulk-create path (no pending header) ──
        const scannedBoxes = boxes
          .filter((b: any) => boxesMatchMap[b.id])
          .map((b: any) => {
            const articleName = b.article ? String(b.article) : ""
            const coldLot = coldStorageItems[articleName]?.lot_no?.trim() || null
            return {
              box_id: String(b.box_id || b.box_number || b.id || ""),
              transfer_out_box_id: b.id,
              article: articleName || null,
              batch_number: b.batch_number ? String(b.batch_number) : null,
              lot_number: coldLot || (b.lot_number ? String(b.lot_number) : null),
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
              box_id: line.box_id || boxRef.box_id || `ART-${i + 1}`,
              transfer_out_box_id: null,
              article: articleName,
              batch_number: line.batch_number || null,
              lot_number: getColdLotNo(articleName) || line.lot_number || null,
              transaction_no: line.transaction_no || boxRef.transaction_no || null,
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
              box_id: line.box_id || boxRef.box_id || `ART-${i + 1}`,
              transfer_out_box_id: null,
              article: articleName,
              batch_number: line.batch_number || null,
              lot_number: getColdLotNo(articleName) || line.lot_number || null,
              transaction_no: line.transaction_no || boxRef.transaction_no || null,
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

        const coldItems = buildColdStoragePayload()
        if (coldItems) payload.cold_storage_items = coldItems

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

          {/* ══════ Cold Storage Fields (Savla / Rishi) ══════ */}
          {isColdStorageTransfer && (
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Snowflake className="h-5 w-5 text-blue-600" />
                  Cold Storage Details — {uniqueColdItems.length} Item{uniqueColdItems.length !== 1 ? "s" : ""}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Fill details per item for {toWarehouse}</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {uniqueColdItems.map((item, idx) => {
                    const ci = coldStorageItems[item.name] || { inward_dt: "", vakkal: "", lot_no: "", rate: "", exporter: "", storage_location: toWarehouse, item_mark: "", group_name: "" }
                    const itemRate = parseFloat(ci.rate) || 0
                    const itemValue = item.totalQty * itemRate

                    return (
                      <div key={item.name} className="p-3 sm:p-4">
                        {/* Item header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-blue-700">{idx + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Total Qty: <span className="font-semibold text-blue-600">{item.totalQty}</span>
                              {item.uom ? ` ${item.uom}` : ""}
                              {item.totalWeight ? ` · ${item.totalWeight.toFixed(2)} kg` : ""}
                              {item.lines.length > 1 ? ` · ${item.lines.length} entries` : ""}
                            </p>
                          </div>
                        </div>

                        {/* Fields grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Company *</Label>
                            <Select value={ci.cold_company || "cfpl"} onValueChange={(val) => updateColdItem(item.name, "cold_company", val)}>
                              <SelectTrigger className="h-8 text-xs bg-white border-gray-200">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cfpl">CFPL</SelectItem>
                                <SelectItem value="cdpl">CDPL</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Inward Date *</Label>
                            <Input type="date" value={ci.inward_dt} onChange={(e) => updateColdItem(item.name, "inward_dt", e.target.value)} className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Vakkal</Label>
                            <Input type="text" value={ci.vakkal} onChange={(e) => updateColdItem(item.name, "vakkal", e.target.value)} placeholder="Vakkal" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Lot No</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={ci.lot_no}
                              onChange={(e) => {
                                const val = e.target.value
                                // Allow empty or positive integers only
                                if (val === "" || /^\d+$/.test(val)) {
                                  updateColdItem(item.name, "lot_no", val)
                                }
                              }}
                              placeholder="Lot number"
                              className={`h-8 text-xs bg-white border-gray-200 ${ci.lot_no && !/^\d+$/.test(ci.lot_no) ? "border-red-400" : ""}`}
                            />
                            {ci.lot_no && !/^\d+$/.test(ci.lot_no) && (
                              <p className="text-[10px] text-red-500">Must be a positive integer</p>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Item Mark</Label>
                            <Input type="text" value={ci.item_mark} onChange={(e) => updateColdItem(item.name, "item_mark", e.target.value)} placeholder="Item mark" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Group Name</Label>
                            <Input type="text" value={ci.group_name} onChange={(e) => updateColdItem(item.name, "group_name", e.target.value)} placeholder="Group" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Sub Group</Label>
                            <Input type="text" value={ci.item_subgroup} onChange={(e) => updateColdItem(item.name, "item_subgroup", e.target.value)} placeholder="Sub group" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Storage Location</Label>
                            <Input type="text" value={ci.storage_location} onChange={(e) => updateColdItem(item.name, "storage_location", e.target.value)} placeholder="Location" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Exporter</Label>
                            <Input type="text" value={ci.exporter} onChange={(e) => updateColdItem(item.name, "exporter", e.target.value)} placeholder="Exporter" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Rate</Label>
                            <Input type="number" step="any" value={ci.rate} onChange={(e) => updateColdItem(item.name, "rate", e.target.value)} placeholder="0.00" className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] font-medium text-gray-500">Value (Qty × Rate)</Label>
                            <div className="h-8 flex items-center px-2 bg-gray-50 border border-gray-200 rounded-md text-xs font-semibold text-gray-800">
                              {itemRate > 0 ? itemValue.toFixed(2) : "—"}
                            </div>
                          </div>
                          <div className="space-y-1 sm:col-span-2">
                            <Label className="text-[11px] font-medium text-gray-500">Spl. Remarks</Label>
                            <Input type="text" value={ci.spl_remarks} onChange={(e) => updateColdItem(item.name, "spl_remarks", e.target.value)} placeholder="Special remarks..." className="h-8 text-xs bg-white border-gray-200" />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {uniqueColdItems.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">No items in this transfer</div>
                )}
              </CardContent>
            </Card>
          )}

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
                    {transferData.challan_no || transferData.transfer_no} — {totalBoxes} boxes, {totalLines} articles
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
              {!allMatched && totalItems > 0 && ["b.hrithik@candorfoods.in", "yash@candorfoods.in"].includes(user?.email?.toLowerCase() || "") && (
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

              {/* ──── BOXES SECTION ──── (hidden when all lines are covered by boxes to avoid duplicates) */}
              {totalBoxes > 0 && !allLinesCoveredByBoxes && (
                <div className="border-b-2 border-gray-200">
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-blue-50/60">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="text-xs sm:text-sm font-semibold text-blue-800">Scanned Boxes ({totalBoxes})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${matchedBoxes === totalBoxes ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {matchedBoxes}/{totalBoxes}
                      </Badge>
                      {matchedBoxes < totalBoxes && (
                        <Button variant="ghost" size="sm" onClick={handleAcknowledgeAllBoxes} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                          <CheckCheck className="h-3 w-3 mr-1" /> All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Desktop column header for boxes */}
                  <div className="hidden md:block">
                    <div className="flex items-center gap-4 px-4 py-2 bg-blue-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      <span className="w-14">#</span>
                      <span className="w-20">Box</span>
                      <span className="w-32">Batch / Lot</span>
                      <span className="w-36">Transaction No</span>
                      <span className="w-24">Net Wt</span>
                      <span className="w-24">Gross Wt</span>
                      <span className="ml-auto w-28 text-right">Action</span>
                    </div>
                  </div>

                  {Object.entries(groupedBoxes).map(([articleName, artBoxes]) => {
                    const artMatched = artBoxes.filter((b: any) => boxesMatchMap[b.id]).length
                    const artTotal = artBoxes.length
                    const allArtMatched = artMatched === artTotal

                    return (
                      <div key={articleName} className="border-b last:border-b-0">
                        {/* Article group header */}
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-50/80">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <Package className="h-3.5 w-3.5 text-violet-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-gray-800 truncate">{articleName}</p>
                              <p className="text-[11px] text-muted-foreground">{artTotal} box{artTotal !== 1 ? "es" : ""}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className={`text-xs ${allArtMatched ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                              {artMatched}/{artTotal}
                            </Badge>
                            {!allArtMatched && (
                              <Button variant="ghost" size="sm" onClick={() => handleAcknowledgeArticleBoxes(articleName)} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                                <CheckCheck className="h-3 w-3 mr-1" /> All
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Box rows */}
                        <div className="divide-y divide-gray-100">
                          {artBoxes.map((b: any) => {
                            const matched = !!boxesMatchMap[b.id]
                            return (
                              <div key={b.id} className={`px-3 sm:px-4 py-2.5 ${matched ? "bg-emerald-50/40" : ""}`}>
                                {/* Mobile */}
                                <div className="md:hidden space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center gap-0.5 text-[11px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                        <Hash className="h-2.5 w-2.5" />{b.id}
                                      </span>
                                      <span className="text-sm font-semibold text-gray-900">Box {b.box_number}</span>
                                    </div>
                                    {matched ? (
                                      <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeBox(b.id)}>
                                        <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                      </Badge>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => handleAcknowledgeBox(b.id)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2.5">
                                        Acknowledge
                                      </Button>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs pl-1">
                                    <div><span className="text-gray-500">Batch:</span> <span className="font-mono font-medium">{b.batch_number || b.lot_number || "-"}</span></div>
                                    <div><span className="text-gray-500">Trans:</span> <span className="font-mono font-medium">{b.transaction_no || "-"}</span></div>
                                    <div><span className="text-gray-500">Net:</span> <span className="font-medium">{b.net_weight || "-"}g</span></div>
                                    <div><span className="text-gray-500">Gross:</span> <span className="font-medium">{b.gross_weight || "-"}g</span></div>
                                  </div>
                                </div>

                                {/* Desktop */}
                                <div className="hidden md:flex items-center gap-4">
                                  <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded w-14 shrink-0">
                                    <Hash className="h-3 w-3" />{b.id}
                                  </span>
                                  <span className="text-sm font-semibold text-gray-900 w-20 shrink-0">Box {b.box_number}</span>
                                  <span className="text-sm font-mono text-gray-600 w-32 truncate">{b.batch_number || b.lot_number || "-"}</span>
                                  <span className="text-sm font-mono text-gray-600 w-36 truncate">{b.transaction_no || "-"}</span>
                                  <span className="text-sm text-gray-600 w-24">{b.net_weight || "-"}g</span>
                                  <span className="text-sm text-gray-600 w-24">{b.gross_weight || "-"}g</span>
                                  <div className="ml-auto shrink-0">
                                    {matched ? (
                                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeBox(b.id)}>
                                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Acknowledged
                                      </Badge>
                                    ) : (
                                      <Button variant="outline" size="sm" onClick={() => handleAcknowledgeBox(b.id)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3">
                                        Acknowledge
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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

              {/* ──── ARTICLE LINES SECTION ──── */}
              {totalLines > 0 && (
                <div>
                  <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-violet-50/60">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-violet-600" />
                      <span className="text-xs sm:text-sm font-semibold text-violet-800">Article Entries ({totalLines})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${resolvedLines === totalLines ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {resolvedLines}/{totalLines}
                      </Badge>
                      {issuedLines > 0 && (
                        <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                          {issuedLines} issue{issuedLines !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {resolvedLines < totalLines && (
                        <Button variant="ghost" size="sm" onClick={handleAcknowledgeAllLines} className="text-xs text-teal-600 hover:text-teal-800 h-7 px-2">
                          <CheckCheck className="h-3 w-3 mr-1" /> All
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Desktop table with horizontal scroll */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full min-w-[900px] text-sm">
                      <thead>
                        <tr className="bg-violet-50/40 border-b text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          <th className="text-center py-2.5 px-2 w-[50px]">Sr. No.</th>
                          <th className="text-left py-2.5 px-3 min-w-[220px]">Item Name</th>
                          {isColdStorageFrom && <th className="text-left py-2.5 px-3 w-[130px]">Transaction No</th>}
                          {isColdStorageFrom && <th className="text-left py-2.5 px-3 w-[120px]">Box ID</th>}
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

                          const totalCols = 7 + (isColdStorageFrom ? 2 : 0) + (hasBatchData ? 1 : 0)

                          return (
                            <Fragment key={index}>
                              <tr className={`${matched ? "bg-emerald-50/40" : issued ? "bg-red-50/30" : "hover:bg-gray-50/50"} transition-colors`}>
                                <td className="py-2.5 px-2 text-center text-gray-500 font-medium tabular-nums">{index + 1}</td>
                                <td className="py-2.5 px-3 font-semibold text-gray-900 max-w-[220px]">
                                  <span className="block truncate" title={line.item_desc_raw || line.item_description}>
                                    {line.item_desc_raw || line.item_description || `Article ${index + 1}`}
                                  </span>
                                </td>
                                {isColdStorageFrom && <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{line.transaction_no || boxData.transaction_no || "-"}</td>}
                                {isColdStorageFrom && <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{line.box_id || boxData.box_id || "-"}</td>}
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.case_pack ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.case_pack) || line.pack_size || "-"}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-blue-600 tabular-nums whitespace-nowrap">{line.qty || line.quantity || 0} <span className="text-gray-400 font-normal text-xs">{line.uom || ""}</span></td>
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.net_weight ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.net_weight) || lineWeights[index]?.net_weight || line.net_weight || "-"}</td>
                                <td className={`py-2.5 px-3 text-right tabular-nums ${issued && linesIssueMap[index]?.total_weight ? "text-red-600 font-bold" : "text-gray-600"}`}>{(issued && linesIssueMap[index]?.total_weight) || lineWeights[index]?.total_weight || line.total_weight || "-"}</td>
                                {hasBatchData && <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{line.batch_number || "-"}</td>}
                                <td className="py-2.5 px-3 text-gray-600 font-mono text-xs truncate">{coldStorageItems[line.item_desc_raw || line.item_description || ""]?.lot_no?.trim() || line.lot_number || "-"}</td>
                                <td className="py-2.5 px-3 sticky right-0 bg-inherit">
                                  <div className="flex items-center justify-end gap-1.5">
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
                                        {isColdStorageFrom ? (
                                          <Button variant="outline" size="sm" onClick={() => handlePrintQR(index)} className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 h-7 px-3">
                                            <Printer className="h-3 w-3 mr-1" /> Print QR
                                          </Button>
                                        ) : (
                                          <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-3">
                                            Acknowledge
                                          </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => handleOpenIssue(index)} className="text-xs text-red-600 border-red-200 hover:bg-red-50 h-7 px-3">
                                          <AlertTriangle className="h-3 w-3 mr-1" /> Issue
                                        </Button>
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
                                        <div className="flex gap-2 justify-end">
                                          <Button variant="outline" size="sm" onClick={handleCancelIssue} className="h-8 px-3 text-xs text-gray-600 border-gray-300">Cancel</Button>
                                          <Button size="sm" onClick={() => handleSubmitIssue(index)} className="h-8 px-4 text-xs bg-red-600 hover:bg-red-700 text-white">
                                            <AlertTriangle className="h-3 w-3 mr-1" /> Submit Issue
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

                      return (
                        <div key={index} className={`px-3 py-3 ${matched ? "bg-emerald-50/40" : issued ? "bg-red-50/30" : ""}`}>
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-gray-900 truncate"><span className="text-gray-500 font-medium mr-1.5">{index + 1}.</span>{line.item_desc_raw || line.item_description || `Article ${index + 1}`}</span>
                              </div>
                              {matched ? (
                                <Badge variant="outline" className="text-[11px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 cursor-pointer hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors" onClick={() => handleUnacknowledgeLine(index)}>
                                  <CheckCircle className="h-3 w-3 mr-0.5" /> Done
                                </Badge>
                              ) : issued ? (
                                <Badge variant="outline" className="text-[11px] bg-red-50 text-red-600 border-red-200 shrink-0">
                                  <AlertTriangle className="h-3 w-3 mr-0.5" /> Issue
                                </Badge>
                              ) : (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isColdStorageFrom ? (
                                    <Button variant="outline" size="sm" onClick={() => handlePrintQR(index)} className="text-xs text-blue-700 border-blue-200 hover:bg-blue-50 h-7 px-2">
                                      <Printer className="h-3 w-3 mr-1" /> QR
                                    </Button>
                                  ) : (
                                    <Button variant="outline" size="sm" onClick={() => handleAcknowledgeLine(index)} className="text-xs text-teal-700 border-teal-200 hover:bg-teal-50 h-7 px-2">
                                      Acknowledge
                                    </Button>
                                  )}
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
                              {isColdStorageFrom && <div><span className="text-gray-500">Trans No:</span> <span className="font-mono font-medium">{line.transaction_no || mobileBoxData.transaction_no || "-"}</span></div>}
                              {isColdStorageFrom && <div><span className="text-gray-500">Box ID:</span> <span className="font-mono font-medium">{line.box_id || mobileBoxData.box_id || "-"}</span></div>}
                              {line.batch_number && <div><span className="text-gray-500">Batch:</span> <span className="font-mono font-medium">{line.batch_number}</span></div>}
                              {(coldStorageItems[line.item_desc_raw || line.item_description || ""]?.lot_no?.trim() || line.lot_number) && <div><span className="text-gray-500">Lot:</span> <span className="font-mono font-medium">{coldStorageItems[line.item_desc_raw || line.item_description || ""]?.lot_no?.trim() || line.lot_number}</span></div>}
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
                    <p className="text-lg sm:text-xl font-bold text-blue-700">{allLinesCoveredByBoxes ? totalLines : totalBoxes + totalLines}</p>
                  </div>
                  <div className="text-center p-2.5 bg-indigo-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Qty</p>
                    <p className="text-lg sm:text-xl font-bold text-indigo-700">
                      {(() => {
                        const qty = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.qty || l.quantity || 0)), 0)
                          + (allLinesCoveredByBoxes ? 0 : boxes.length)
                        return qty
                      })()}
                    </p>
                  </div>
                  <div className="text-center p-2.5 bg-emerald-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Net Wt</p>
                    <p className="text-lg sm:text-xl font-bold text-emerald-700">
                      {(() => {
                        let total = 0
                        if (allLinesCoveredByBoxes) {
                          total = boxes.reduce((sum: number, b: any) => sum + (parseFloat(b.net_weight) || 0), 0)
                        } else {
                          total = boxes.reduce((sum: number, b: any) => sum + (parseFloat(b.net_weight) || 0), 0)
                            + lines.reduce((sum: number, l: any, i: number) => sum + (parseFloat(lineWeights[i]?.net_weight || l.net_weight) || 0), 0)
                        }
                        return `${total.toFixed(2)} kg`
                      })()}
                    </p>
                  </div>
                  <div className="text-center p-2.5 bg-amber-50/60 rounded-lg">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Total Gross Wt</p>
                    <p className="text-lg sm:text-xl font-bold text-amber-700">
                      {(() => {
                        let total = 0
                        if (allLinesCoveredByBoxes) {
                          total = boxes.reduce((sum: number, b: any) => sum + (parseFloat(b.gross_weight) || 0), 0)
                        } else {
                          total = boxes.reduce((sum: number, b: any) => sum + (parseFloat(b.gross_weight) || 0), 0)
                            + lines.reduce((sum: number, l: any, i: number) => sum + (parseFloat(lineWeights[i]?.total_weight || l.total_weight) || 0), 0)
                        }
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
            </CardContent>
          </Card>
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
