"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getDisplayWarehouseName } from "@/lib/constants/warehouses"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ArrowLeft, ArrowRight, Plus, Loader2, Search,
  Package, Send, Inbox, ClipboardList, Eye, CheckCircle,
  Truck, RefreshCw, Pencil, Printer, Trash2, AlertTriangle, Info,
  BarChart3, TrendingUp, Filter, Download, Activity, Users, Layers, Box
} from "lucide-react"
import QRCode from 'qrcode'
import type { Company } from "@/types/auth"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"

// ─── Article Entry types ───
interface GeneratedArticle {
  transaction_no: string
  box_id: string
  box_number: number
  item_group: string
  sub_group: string
  item_description: string
  net_weight: number
  gross_weight: number
  // Cold storage fields
  vakkal: string
  lot_no: string
  item_mark: string
  storage_location: string
  exporter: string
  rate: number
  spl_remarks: string
}

interface JobWorkPageProps {
  params: {
    company: Company
  }
}

// ─── Inward Receipt Item ───
interface IRItem {
  sl_no: number
  description: string
  sent_kgs: number
  sent_boxes: number
  // Cumulative from previous IRs
  prev_fg_kgs: number
  prev_waste_kgs: number
  prev_rejection_kgs: number
  // This batch inputs
  fg_kgs: number
  waste_kgs: number
  rejection_kgs: number
  // Calculated
  total_accounted_kgs: number
  unaccounted_kgs: number
  loss_pct: number
}

// ─── Loss Config ───
interface LossConfig {
  min_loss_pct: number
  max_loss_pct: number
  loss_component: string
  waste_with_partial: boolean
  single_shot: boolean
}

// ─── Job Work Record (for listing) ───
interface JobWorkRecord {
  id: number
  challan_no: string
  job_work_date: string
  from_warehouse: string
  to_party: string
  party_address: string
  status: string
  type: 'OUT' | 'IN'
  vehicle_no: string
  driver_name: string
  authorized_person: string
  remarks: string
  items_count: number
  item_descriptions: string
  total_qty: number
  total_weight: number
  created_by: string
  created_at: string
}

export default function JobWorkPage({ params }: JobWorkPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuthStore()
  const DELETE_ALLOWED_EMAILS = ["b.hrithik@candorfoods.in", "yash@candorfoods.in"]
  const canDelete = user?.email ? DELETE_ALLOWED_EMAILS.includes(user.email) : false

  const [activeTab, setActiveTab] = useState("records")

  const now = new Date()
  const currentDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

  // ════════════════════════════════════════
  //  MATERIAL IN (INWARD RECEIPT)
  // ════════════════════════════════════════
  const [miSearchChallan, setMiSearchChallan] = useState("")
  const [miChallanNo, setMiChallanNo] = useState("")
  const [miSearching, setMiSearching] = useState(false)
  const [miFoundRecord, setMiFoundRecord] = useState<any>(null)
  const [miLossConfig, setMiLossConfig] = useState<LossConfig | null>(null)
  const [miReceiveCount, setMiReceiveCount] = useState(0)
  const [miItems, setMiItems] = useState<IRItem[]>([])
  const [miReceiptDate, setMiReceiptDate] = useState(currentDate)
  const [miVehicleNo, setMiVehicleNo] = useState("")
  const [miDriverName, setMiDriverName] = useState("")
  const [miRemarks, setMiRemarks] = useState("")
  const [miSubmitting, setMiSubmitting] = useState(false)
  const [miPriorIRs, setMiPriorIRs] = useState<Array<{ ir_number: string; challan_no: string; receipt_date: string; receipt_type: string; total_fg_kgs: number; total_waste_kgs: number; total_rejection_kgs: number }>>([])

  // ════════════════════════════════════════
  //  ARTICLE ENTRY (Box ID + QR Generation)
  // ════════════════════════════════════════
  const [aeItemGroups, setAeItemGroups] = useState<string[]>([])
  const [aeSubGroups, setAeSubGroups] = useState<string[]>([])
  const [aeDescriptions, setAeDescriptions] = useState<string[]>([])
  const [aeSelectedGroup, setAeSelectedGroup] = useState("")
  const [aeSelectedSubGroup, setAeSelectedSubGroup] = useState("")
  const [aeSelectedDesc, setAeSelectedDesc] = useState("")
  const [aeQuantity, setAeQuantity] = useState<number>(0)
  const [aeNetWeight, setAeNetWeight] = useState<number>(0)
  const [aeGrossWeight, setAeGrossWeight] = useState<number>(0)
  // Cold storage fields
  const [aeColdCompany, setAeColdCompany] = useState<string>(company.toUpperCase() === 'CDPL' ? 'cdpl' : 'cfpl')
  const [aeInwardDate, setAeInwardDate] = useState(() => {
    const d = new Date(); return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
  })
  const [aeVakkal, setAeVakkal] = useState("")
  const [aeLotNo, setAeLotNo] = useState("")
  const [aeItemMark, setAeItemMark] = useState("")
  const [aeStorageLocation, setAeStorageLocation] = useState("")
  const [aeExporter, setAeExporter] = useState("")
  const [aeRate, setAeRate] = useState<number>(0)
  const [aeSplRemarks, setAeSplRemarks] = useState("")
  const [aeSearchText, setAeSearchText] = useState("")
  const [aeSearchResults, setAeSearchResults] = useState<Array<{ item_description: string; item_group: string; sub_group: string }>>([])
  const [aeSearching, setAeSearching] = useState(false)
  const [aeSearchOpen, setAeSearchOpen] = useState(false)
  const [aeLoadingGroups, setAeLoadingGroups] = useState(false)
  const [aeLoadingSubs, setAeLoadingSubs] = useState(false)
  const [aeLoadingDescs, setAeLoadingDescs] = useState(false)
  const [aeGeneratedArticles, setAeGeneratedArticles] = useState<GeneratedArticle[]>([])
  const [aePrintingQR, setAePrintingQR] = useState(false)

  // Load item groups from all_sku on mount
  useEffect(() => {
    const loadItemGroups = async () => {
      setAeLoadingGroups(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setAeItemGroups(data.options?.item_categories || [])
      } catch { setAeItemGroups([]) }
      finally { setAeLoadingGroups(false) }
    }
    loadItemGroups()
  }, [company])

  const handleAeGroupChange = async (group: string) => {
    setAeSelectedGroup(group)
    setAeSelectedSubGroup("")
    setAeSelectedDesc("")
    setAeSubGroups([])
    setAeDescriptions([])
    if (!group) return
    setAeLoadingSubs(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown?item_category=${encodeURIComponent(group)}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setAeSubGroups(data.options?.sub_categories || [])
    } catch { setAeSubGroups([]) }
    finally { setAeLoadingSubs(false) }
  }

  const handleAeSubGroupChange = async (sub: string) => {
    setAeSelectedSubGroup(sub)
    setAeSelectedDesc("")
    setAeDescriptions([])
    if (!sub) return
    setAeLoadingDescs(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-dropdown?item_category=${encodeURIComponent(aeSelectedGroup)}&sub_category=${encodeURIComponent(sub)}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setAeDescriptions(data.options?.item_descriptions || [])
    } catch { setAeDescriptions([]) }
    finally { setAeLoadingDescs(false) }
  }

  // Search all_sku by item description (debounced)
  useEffect(() => {
    if (aeSearchText.trim().length < 2) { setAeSearchResults([]); setAeSearchOpen(false); return }
    const timer = setTimeout(async () => {
      setAeSearching(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/all-sku-search?search=${encodeURIComponent(aeSearchText.trim())}&limit=100`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Failed")
        const data = await res.json()
        setAeSearchResults(data.items || [])
        setAeSearchOpen(true)
      } catch { setAeSearchResults([]) }
      finally { setAeSearching(false) }
    }, 300)
    return () => clearTimeout(timer)
  }, [aeSearchText])

  const handleAeSearchSelect = (item: { item_description: string; item_group: string; sub_group: string }) => {
    // Ensure the selected values exist in the dropdown options so Select renders them
    setAeItemGroups(prev => prev.includes(item.item_group) ? prev : [...prev, item.item_group])
    setAeSubGroups(prev => prev.includes(item.sub_group) ? prev : [item.sub_group, ...prev])
    setAeDescriptions(prev => prev.includes(item.item_description) ? prev : [item.item_description, ...prev])
    setAeSelectedGroup(item.item_group)
    setAeSelectedSubGroup(item.sub_group)
    setAeSelectedDesc(item.item_description)
    setAeSearchText("")
    setAeSearchResults([])
    setAeSearchOpen(false)
  }

  // Article entry: total net weight of all boxes vs FG received
  const aeTotalNetWeight = aeGeneratedArticles.reduce((s, a) => s + a.net_weight, 0)
  const aeFgLimit = miItems.reduce((s, i) => s + i.fg_kgs, 0)

  // Generate transaction number + box IDs
  const generateArticleEntries = () => {
    if (!aeSelectedDesc || aeQuantity < 1) {
      toast({ title: "Missing Fields", description: "Select item description and enter quantity (min 1).", variant: "destructive" })
      return
    }
    // Validate total net weight won't exceed FG received
    if (aeFgLimit > 0) {
      const newTotal = aeTotalNetWeight + (aeNetWeight * aeQuantity)
      if (newTotal > aeFgLimit + 0.01) {
        toast({ title: "Weight Exceeds FG Received", description: `Total net wt (${newTotal.toFixed(2)} kg) would exceed FG Received (${aeFgLimit.toFixed(2)} kg).`, variant: "destructive" })
        return
      }
    }
    const now = new Date()
    const txnNo = `TR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`
    const base = String(Date.now()).slice(-8)

    const entries: GeneratedArticle[] = []
    for (let i = 1; i <= aeQuantity; i++) {
      entries.push({
        transaction_no: txnNo,
        box_id: `${base}-${i}`,
        box_number: i,
        item_group: aeSelectedGroup,
        sub_group: aeSelectedSubGroup,
        item_description: aeSelectedDesc,
        net_weight: aeNetWeight,
        gross_weight: aeGrossWeight,
        vakkal: aeVakkal,
        lot_no: aeLotNo,
        item_mark: aeItemMark,
        storage_location: aeStorageLocation,
        exporter: aeExporter,
        rate: aeRate,
        spl_remarks: aeSplRemarks,
      })
    }
    setAeGeneratedArticles(prev => [...prev, ...entries])
    toast({ title: "Articles Generated", description: `${aeQuantity} box entries created with Txn: ${txnNo}` })
    // Reset qty
    setAeQuantity(0)
    setAeNetWeight(0)
    setAeGrossWeight(0)
  }

  // Print QR label — exact same format as inward QR (QR left, info right, 4"×2")
  const handlePrintArticleQR = async (singleIndex?: number) => {
    const articles = singleIndex !== undefined ? [aeGeneratedArticles[singleIndex]] : aeGeneratedArticles
    if (articles.length === 0) return
    setAePrintingQR(true)

    try {
      const companyLabel = company.toUpperCase()
      const entryDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })

      // Build label HTML for each article
      let labelsHtml = ''
      for (const art of articles) {
        const qrDataString = JSON.stringify({ tx: art.transaction_no, bi: art.box_id })
        const qrDataURL = await QRCode.toDataURL(qrDataString, { width: 170, margin: 1, errorCorrectionLevel: 'M' })

        labelsHtml += `
          <div class="label">
            <div class="qr"><img src="${qrDataURL}" /></div>
            <div class="info">
              <div>
                <div class="company">${companyLabel}</div>
                <div class="txn">${art.transaction_no}</div>
                <div class="boxid">ID: ${art.box_id}</div>
              </div>
              <div class="item">${art.item_description}</div>
              <div>
                <div class="detail"><b>Box #${art.box_number}</b> &nbsp; Net: ${art.net_weight > 0 ? art.net_weight + 'kg' : '\u2014'} &nbsp; Gross: ${art.gross_weight > 0 ? art.gross_weight + 'kg' : '\u2014'}</div>
                <div class="detail">Entry: ${entryDate}</div>
              </div>
              <div class="lot">${art.item_group} \u00b7 ${art.sub_group}</div>
            </div>
          </div>`
      }

      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-9999px'
      iframe.style.top = '-9999px'
      iframe.style.width = '0'
      iframe.style.height = '0'
      document.body.appendChild(iframe)

      const doc = iframe.contentWindow?.document
      if (!doc) { setAePrintingQR(false); document.body.removeChild(iframe); return }

      doc.open()
      doc.write(`<!DOCTYPE html><html><head><title>Label</title><style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 4in; overflow: hidden; background: white; }
        @page { size: 4in 2in; margin: 0; padding: 0; }
        @media print {
          html, body { width: 4in; overflow: hidden; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        .label { width: 4in; height: 2in; background: white; border: 1px solid #000; display: flex; font-family: Arial, sans-serif; page-break-after: always; page-break-inside: avoid; }
        .label:last-child { page-break-after: auto; }
        .qr { width: 2in; height: 2in; display: flex; align-items: center; justify-content: center; padding: 0.1in; }
        .qr img { width: 1.7in; height: 1.7in; }
        .info { width: 2in; height: 2in; padding: 0.08in; font-size: 8pt; line-height: 1.2; display: flex; flex-direction: column; justify-content: space-between; }
        .company { font-weight: bold; font-size: 9pt; }
        .txn { font-family: monospace; font-size: 7pt; }
        .boxid { font-family: monospace; font-size: 6.5pt; color: #555; }
        .item { font-weight: bold; font-size: 7.5pt; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .detail { font-size: 7pt; }
        .lot { font-family: monospace; border-top: 1px solid #ccc; padding-top: 2px; font-size: 6.5pt; }
      </style></head><body>${labelsHtml}
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
        if (e.data === 'print-complete') {
          window.removeEventListener('message', cleanup)
          if (document.body.contains(iframe)) document.body.removeChild(iframe)
          setAePrintingQR(false)
        }
      }
      window.addEventListener('message', cleanup)
      setTimeout(() => {
        if (document.body.contains(iframe)) document.body.removeChild(iframe)
        window.removeEventListener('message', cleanup)
        setAePrintingQR(false)
      }, 30000)
    } catch (err) {
      console.error('QR print failed:', err)
      setAePrintingQR(false)
    }
  }

  // Material In records listing
  const [miRecords, setMiRecords] = useState<any[]>([])
  const [miRecordsLoading, setMiRecordsLoading] = useState(false)
  const [miRecordsPage, setMiRecordsPage] = useState(1)
  const [miRecordsTotal, setMiRecordsTotal] = useState(0)
  const [miRecordsTotalPages, setMiRecordsTotalPages] = useState(1)

  // View inward receipt detail
  const [viewIROpen, setViewIROpen] = useState(false)
  const [viewIRData, setViewIRData] = useState<any>(null)
  const [viewIRLoading, setViewIRLoading] = useState(false)

  const handleViewIR = async (irId: number) => {
    setViewIRLoading(true)
    setViewIROpen(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/${irId}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load receipt details")
      const data = await res.json()
      setViewIRData(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
      setViewIROpen(false)
    } finally {
      setViewIRLoading(false)
    }
  }

  const loadMiRecords = async (page: number = 1) => {
    setMiRecordsLoading(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/list?page=${page}&per_page=10`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load")
      const data = await res.json()
      setMiRecords(data.records || [])
      setMiRecordsTotal(data.total || 0)
      setMiRecordsTotalPages(data.total_pages || 1)
      setMiRecordsPage(page)
    } catch {
      setMiRecords([])
    } finally {
      setMiRecordsLoading(false)
    }
  }

  const handleDeleteMiRecord = async (id: number, irNumber: string) => {
    if (!confirm(`Delete inward receipt "${irNumber}"?`)) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in/${id}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE' })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Deleted", description: `${irNumber} deleted successfully` })
      loadMiRecords(miRecordsPage)
    } catch {
      toast({ title: "Error", description: "Failed to delete record", variant: "destructive" })
    }
  }

  // Search for outward record by challan number
  const handleSearchMaterialOut = async () => {
    if (!miSearchChallan.trim()) {
      toast({ title: "Search Required", description: "Enter challan number to search.", variant: "destructive" })
      return
    }
    setMiSearching(true)
    setMiFoundRecord(null)
    setMiItems([])
    setMiLossConfig(null)
    setMiReceiveCount(0)
    try {
      const params = new URLSearchParams({ challan_no: miSearchChallan.trim() })
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out/search?${params.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Not found (${res.status})`)
      }
      const data = await res.json()
      const record = data.record
      if (!record) throw new Error("No record found")

      setMiFoundRecord(record)
      setMiLossConfig(data.loss_config || null)
      setMiReceiveCount(data.receive_count || 0)
      setMiPriorIRs(data.prior_irs || [])

      const lines = data.line_items || []
      const processType = (record.sub_category || "").toLowerCase()
      const lossConfig = data.loss_config as LossConfig | null

      setMiItems(lines.map((line: any, idx: number) => {
        const sentKgs = Number(line.quantity_kgs || line.net_weight || 0)
        const sentBoxes = Number(line.quantity_boxes || 0)
        const prevFg = Number(line.prev_fg_kgs || 0)
        const prevWaste = Number(line.prev_waste_kgs || 0)
        const prevRejection = Number(line.prev_rejection_kgs || 0)
        const totalAccounted = prevFg + prevWaste + prevRejection
        const unaccounted = parseFloat((sentKgs - totalAccounted).toFixed(3))

        return {
          sl_no: line.sl_no || idx + 1,
          description: line.item_description || "",
          sent_kgs: sentKgs,
          sent_boxes: sentBoxes,
          prev_fg_kgs: prevFg,
          prev_waste_kgs: prevWaste,
          prev_rejection_kgs: prevRejection,
          fg_kgs: 0,
          waste_kgs: 0,
          rejection_kgs: 0,
          total_accounted_kgs: totalAccounted,
          unaccounted_kgs: unaccounted,
          loss_pct: sentKgs > 0 ? parseFloat(((unaccounted / sentKgs) * 100).toFixed(2)) : 0,
        }
      }))

      toast({ title: "Record Found", description: `Challan ${record.challan_no} loaded — ${lines.length} item(s), ${data.receive_count || 0} prior IR(s)` })
    } catch (error: any) {
      toast({ title: "Not Found", description: error.message || "No matching record found.", variant: "destructive" })
    } finally {
      setMiSearching(false)
    }
  }

  // Add Stock — pre-fill material-in form from a record's challan and switch to Material In tab
  const handleAddStock = (challanNo: string) => {
    setMiSearchChallan(challanNo)
    setMiFoundRecord(null)
    setMiItems([])
    setMiLossConfig(null)
    setMiReceiveCount(0)
    setMiChallanNo("")
    setMiVehicleNo("")
    setMiDriverName("")
    setMiRemarks("")
    setActiveTab("create-in")
    // Trigger search after state updates
    setTimeout(async () => {
      try {
        const params = new URLSearchParams({ challan_no: challanNo.trim() })
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out/search?${params.toString()}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error("Not found")
        const data = await res.json()
        const record = data.record
        if (!record) throw new Error("No record found")

        setMiFoundRecord(record)
        setMiSearchChallan(challanNo)
        setMiLossConfig(data.loss_config || null)
        setMiReceiveCount(data.receive_count || 0)
        setMiPriorIRs(data.prior_irs || [])

        const lines = data.line_items || []
        setMiItems(lines.map((line: any, idx: number) => {
          const sentKgs = Number(line.quantity_kgs || line.net_weight || 0)
          const sentBoxes = Number(line.quantity_boxes || 0)
          const prevFg = Number(line.prev_fg_kgs || 0)
          const prevWaste = Number(line.prev_waste_kgs || 0)
          const prevRejection = Number(line.prev_rejection_kgs || 0)
          const totalAccounted = prevFg + prevWaste + prevRejection
          const unaccounted = parseFloat((sentKgs - totalAccounted).toFixed(3))
          return {
            sl_no: line.sl_no || idx + 1,
            description: line.item_description || "",
            sent_kgs: sentKgs,
            sent_boxes: sentBoxes,
            prev_fg_kgs: prevFg,
            prev_waste_kgs: prevWaste,
            prev_rejection_kgs: prevRejection,
            fg_kgs: 0,
            waste_kgs: 0,
            rejection_kgs: 0,
            total_accounted_kgs: totalAccounted,
            unaccounted_kgs: unaccounted,
            loss_pct: sentKgs > 0 ? parseFloat(((unaccounted / sentKgs) * 100).toFixed(2)) : 0,
          }
        }))
        toast({ title: "Record Loaded", description: `${challanNo} loaded — ready for next inward receipt` })
      } catch {
        toast({ title: "Error", description: "Failed to load record. Try searching manually.", variant: "destructive" })
      }
    }, 100)
  }

  // Update item quantities — recalculate totals
  const updateIRItem = (idx: number, field: 'fg_kgs' | 'waste_kgs' | 'rejection_kgs', value: number) => {
    setMiItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      const totalFg = updated.prev_fg_kgs + updated.fg_kgs
      const totalWaste = updated.prev_waste_kgs + updated.waste_kgs
      const totalRejection = updated.prev_rejection_kgs + updated.rejection_kgs
      updated.total_accounted_kgs = parseFloat((totalFg + totalWaste + totalRejection).toFixed(3))
      updated.unaccounted_kgs = parseFloat((updated.sent_kgs - updated.total_accounted_kgs).toFixed(3))
      updated.loss_pct = updated.sent_kgs > 0 ? parseFloat(((updated.unaccounted_kgs / updated.sent_kgs) * 100).toFixed(2)) : 0
      return updated
    }))
  }

  // Validation
  const validateMaterialIn = (): string[] => {
    const errors: string[] = []
    if (!miChallanNo.trim()) errors.push("Inward Challan No is required")
    const hasAnyInput = miItems.some(i => i.fg_kgs > 0 || i.waste_kgs > 0 || i.rejection_kgs > 0)
    if (!hasAnyInput) errors.push("Enter received quantity for at least one item")

    // Check if any item exceeds dispatched quantity
    for (const item of miItems) {
      if (item.total_accounted_kgs > item.sent_kgs * 1.001) {
        errors.push(`${item.description}: Total received (${item.total_accounted_kgs.toFixed(2)} kg) exceeds dispatched (${item.sent_kgs.toFixed(2)} kg)`)
      }
    }

    return errors
  }

  // Get loss tolerance status
  const getLossToleranceStatus = () => {
    if (!miLossConfig) return null
    const totalSent = miItems.reduce((s, i) => s + i.sent_kgs, 0)
    const totalUnaccounted = miItems.reduce((s, i) => s + i.unaccounted_kgs, 0)
    if (totalSent === 0) return null
    const lossPct = (totalUnaccounted / totalSent) * 100

    if (lossPct >= miLossConfig.min_loss_pct && lossPct <= miLossConfig.max_loss_pct) {
      return { status: "normal", label: "Within Expected Range", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
    } else if (lossPct < miLossConfig.min_loss_pct) {
      return { status: "underweight", label: "Below Expected — Possible Vendor Retention", color: "bg-amber-50 text-amber-700 border-amber-200" }
    } else {
      return { status: "excess", label: "Excess Loss — Needs Review", color: "bg-red-50 text-red-700 border-red-200" }
    }
  }

  // Submit
  const handleSubmitMaterialIn = async (e: React.FormEvent, receiptType: "partial" | "final" = "partial") => {
    e.preventDefault()
    if (!miFoundRecord) return

    const errors = validateMaterialIn()
    if (errors.length > 0) {
      toast({ title: `Validation Error (${errors.length})`, description: errors.join(" • "), variant: "destructive" })
      return
    }

    setMiSubmitting(true)
    const payload = {
      challan_no: miChallanNo.trim(),
      original_challan_no: miFoundRecord.challan_no,
      original_record_id: miFoundRecord.id,
      receipt_type: receiptType,
      received_date: miReceiptDate,
      vehicle_no: miVehicleNo,
      driver_name: miDriverName,
      remarks: miRemarks,
      inward_warehouse: miFoundRecord.from_warehouse || "",
      cold_company: isColdStorageInward ? aeColdCompany : "",
      cold_inward_date: isColdStorageInward ? aeInwardDate : "",
      loss_config: miLossConfig ? {
        process_type: miFoundRecord?.sub_category || "",
        min_loss_pct: miLossConfig.min_loss_pct,
        max_loss_pct: miLossConfig.max_loss_pct,
        loss_component: miLossConfig.loss_component,
        waste_with_partial: miLossConfig.waste_with_partial,
        single_shot: miLossConfig.single_shot,
      } : undefined,
      items: miItems.map(item => ({
        sl_no: item.sl_no,
        description: item.description,
        sent_kgs: item.sent_kgs,
        sent_boxes: item.sent_boxes,
        finished_goods_kgs: item.fg_kgs,
        finished_goods_boxes: 0,
        waste_kgs: item.waste_kgs,
        waste_type: miLossConfig?.loss_component || "",
        rejection_kgs: item.rejection_kgs,
        rejection_boxes: 0,
        line_remarks: "",
      })),
      boxes: aeGeneratedArticles.map(art => ({
        transaction_no: art.transaction_no,
        box_id: art.box_id,
        box_number: art.box_number,
        item_description: art.item_description,
        item_group: art.item_group,
        sub_group: art.sub_group,
        net_weight: art.net_weight,
        gross_weight: art.gross_weight,
        vakkal: art.vakkal,
        lot_no: art.lot_no,
        item_mark: art.item_mark,
        storage_location: art.storage_location,
        exporter: art.exporter,
        rate: art.rate,
        spl_remarks: art.spl_remarks,
      })),
    }

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/material-in?created_by=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Submission failed: ${res.status}`)
      }
      const result = await res.json()
      toast({ title: "Inward Receipt Recorded", description: `Recorded against challan ${miFoundRecord.challan_no}` })
      // Reset
      setMiSearchChallan("")
      setMiChallanNo("")
      setMiFoundRecord(null)
      setMiItems([])
      setMiLossConfig(null)
      setMiReceiveCount(0)
      setMiPriorIRs([])
      setMiVehicleNo("")
      setMiDriverName("")
      setMiRemarks("")
      setAeGeneratedArticles([])
      setActiveTab("create-in")
      loadRecords(1)
      loadMiRecords(1)
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message || "Failed to submit.", variant: "destructive" })
    } finally {
      setMiSubmitting(false)
    }
  }

  // ════════════════════════════════════════
  //  JOB WORK RECORDS (LISTING)
  // ════════════════════════════════════════
  const [records, setRecords] = useState<JobWorkRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsPage, setRecordsPage] = useState(1)
  const [recordsTotalPages, setRecordsTotalPages] = useState(1)
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsFilterChallan, setRecordsFilterChallan] = useState("")
  const [recordsFilterStatus, setRecordsFilterStatus] = useState("all")
  const [recordsFilterDate, setRecordsFilterDate] = useState("")

  const loadRecords = async (page: number = 1) => {
    setRecordsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "15" })
      if (recordsFilterChallan.trim()) params.append("challan_no", recordsFilterChallan.trim())
      if (recordsFilterStatus && recordsFilterStatus !== "all") params.append("status", recordsFilterStatus)
      if (recordsFilterDate) params.append("date", recordsFilterDate)
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/list?${params.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load records")
      const data = await res.json()
      setRecords((data.records || []).map((r: any) => ({
        ...r,
        total_qty: Number(r.total_qty || 0),
        total_weight: Number(r.total_weight || 0),
        items_count: Number(r.items_count || 0),
      })))
      setRecordsTotalPages(data.total_pages || 1)
      setRecordsTotal(data.total || 0)
      setRecordsPage(page)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setRecordsLoading(false)
    }
  }

  useEffect(() => { loadRecords(1) }, [recordsFilterStatus, recordsFilterDate])
  useEffect(() => { if (activeTab === "create-in") loadMiRecords(1) }, [activeTab])

  const handleDeleteRecord = async (id: number, challanNo: string) => {
    if (!confirm(`Delete record ${challanNo}? This cannot be undone.`)) return
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/${id}?user_email=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, { method: 'DELETE' })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Deleted", description: `Record ${challanNo} deleted.` })
      loadRecords(recordsPage)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      sent: { label: "Material Out", className: "bg-blue-50 text-blue-700 border-blue-200" },
      partially_received: { label: "Partial Return", className: "bg-amber-50 text-amber-700 border-amber-200" },
      fully_received: { label: "Fully Received", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      reconciled: { label: "Reconciled", className: "bg-violet-50 text-violet-700 border-violet-200" },
      closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
      cancelled: { label: "Cancelled", className: "bg-red-50 text-red-600 border-red-200" },
    }
    const s = map[status] || { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" }
    return <Badge variant="outline" className={`text-[10px] font-semibold ${s.className}`}>{s.label}</Badge>
  }

  // Computed values for Material In
  const totals = {
    sent_kgs: miItems.reduce((s, i) => s + i.sent_kgs, 0),
    prev_fg: miItems.reduce((s, i) => s + i.prev_fg_kgs, 0),
    prev_waste: miItems.reduce((s, i) => s + i.prev_waste_kgs, 0),
    prev_rejection: miItems.reduce((s, i) => s + i.prev_rejection_kgs, 0),
    this_fg: miItems.reduce((s, i) => s + i.fg_kgs, 0),
    this_waste: miItems.reduce((s, i) => s + i.waste_kgs, 0),
    this_rejection: miItems.reduce((s, i) => s + i.rejection_kgs, 0),
    unaccounted: miItems.reduce((s, i) => s + i.unaccounted_kgs, 0),
  }
  const totalAccountedKgs = totals.prev_fg + totals.prev_waste + totals.prev_rejection + totals.this_fg + totals.this_waste + totals.this_rejection
  const isFullyAccounted = totals.sent_kgs > 0 && Math.abs(totals.sent_kgs - totalAccountedKgs) < 0.01
  const overallLossPct = totals.sent_kgs > 0 ? (totals.unaccounted / totals.sent_kgs) * 100 : 0
  const toleranceStatus = getLossToleranceStatus()

  // Cold storage detection
  const isColdStorageInward = (miFoundRecord?.from_warehouse || "").toLowerCase().includes("cold")

  // Process type display helpers
  const processType = miFoundRecord?.sub_category || ""
  const isThermopacking = processType.toLowerCase().includes("thermo")
  const showWasteColumn = !isThermopacking
  const wasteLabel = miLossConfig?.loss_component || "Waste/Byproduct"

  // ════════════════════════════════════════
  //  REPORTS / DASHBOARD
  // ════════════════════════════════════════
  const [rptLoading, setRptLoading] = useState(false)
  const [rptData, setRptData] = useState<any>(null)
  const [rptFilterProcess, setRptFilterProcess] = useState("")
  const [rptFilterVendor, setRptFilterVendor] = useState("")
  const [rptFilterItem, setRptFilterItem] = useState("")
  const [rptFilterFrom, setRptFilterFrom] = useState("")
  const [rptFilterTo, setRptFilterTo] = useState("")
  const [rptActiveView, setRptActiveView] = useState<"process" | "vendor" | "item" | "trend" | "matrix">("process")

  const loadReportWithParams = async (filterProcess: string, filterVendor: string, filterItem: string, from: string, to: string) => {
    setRptLoading(true)
    try {
      const p = new URLSearchParams()
      if (filterProcess && filterProcess !== "all") p.append("sub_category", filterProcess)
      if (filterVendor && filterVendor !== "all") p.append("vendor", filterVendor)
      if (filterItem && filterItem !== "all") p.append("item", filterItem)
      if (from) {
        const [y, m, d] = from.split('-')
        p.append("from_date", `${d}-${m}-${y}`)
      }
      if (to) {
        const [y, m, d] = to.split('-')
        p.append("to_date", `${d}-${m}-${y}`)
      }
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/reports/dashboard?${p.toString()}`
      const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error("Failed to load report")
      const data = await res.json()
      setRptData(data)
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    } finally {
      setRptLoading(false)
    }
  }

  const loadReport = () => loadReportWithParams(rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo)

  // Auto-reload on any filter change (debounced for date fields)
  useEffect(() => {
    if (activeTab !== "reports") return
    const timer = setTimeout(() => {
      loadReportWithParams(rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo)
    }, 100)
    return () => clearTimeout(timer)
  }, [activeTab, rptFilterProcess, rptFilterVendor, rptFilterItem, rptFilterFrom, rptFilterTo])

  const rptSummary = rptData?.summary || {}
  const rptStatusCounts = rptData?.status_counts || {}
  const rptByProcess = rptData?.by_process || []
  const rptByVendor = rptData?.by_vendor || []
  const rptByItem = rptData?.by_item || []
  const rptMonthly = rptData?.monthly_trend || []
  const rptVendorItem = rptData?.vendor_item_matrix || []
  // Hardcoded options (same as material-out form) merged with DB options
  const PROCESS_OPTIONS = ["De seeding", "Dicing", "Cracking", "Stuffing", "Vacuum Packaging", "Slicing", "Thermopacking"]
  const VENDOR_OPTIONS = ["UNAZO CORPORATION", "Krishnat Kerba Chavan", "AL SAKHI ENTERPRISES", "MIE FOODS INDIA PRIVATE LIMITED", "HAG CORPORATION"]

  const dbFilterOpts = rptData?.filter_options || { sub_categories: [], vendors: [], items: [] }
  const rptFilterOpts = {
    sub_categories: [...new Set([...PROCESS_OPTIONS, ...(dbFilterOpts.sub_categories || [])])].sort(),
    vendors: [...new Set([...VENDOR_OPTIONS, ...(dbFilterOpts.vendors || [])])].sort(),
    items: dbFilterOpts.items || [],
  }

  // Helper: bar width for visual bars
  const barWidth = (val: number, max: number) => max > 0 ? Math.max(4, (val / max) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/${company}/transfer`)} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Job Work</h1>
            <p className="text-xs text-muted-foreground">Outsourced processing — Material Out & Inward Receipts</p>
          </div>
        </div>
        <Button size="sm" onClick={() => router.push(`/${company}/transfer/job-work/material-out`)}
          className="bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm self-end sm:self-auto">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> New Material Out
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full sm:w-auto grid grid-cols-3 h-10 bg-gray-100 rounded-lg p-1">
          <TabsTrigger value="records" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /><span className="hidden sm:inline">Records</span><span className="sm:hidden">Records</span>
          </TabsTrigger>
          <TabsTrigger value="create-in" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" /><span className="hidden sm:inline">Material In</span><span className="sm:hidden">In</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Reports</span><span className="sm:hidden">Report</span>
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: MATERIAL IN (INWARD RECEIPT)         */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="create-in" className="mt-4 space-y-4">
          <form onSubmit={handleSubmitMaterialIn} className="space-y-4">

            {/* ─── Search Section ─── */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Search className="h-4 w-4 text-teal-600" />
                  Search Material Out Challan
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Enter the challan number from the outward dispatch to record inward receipt
                </p>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs font-medium text-gray-600">Challan No *</Label>
                    <Input value={miSearchChallan}
                      onChange={(e) => setMiSearchChallan(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearchMaterialOut() } }}
                      className="h-9 bg-white border-gray-200" placeholder="e.g. JB202603201430" />
                  </div>
                  <div className="flex items-end">
                    <Button type="button" onClick={handleSearchMaterialOut} disabled={miSearching}
                      className="h-9 px-5 bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
                      {miSearching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                      Find Record
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ─── Material In Records ─── */}
            {!miFoundRecord && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b bg-white">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-teal-600" />
                      Inward Receipt Records
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{miRecordsTotal} receipt{miRecordsTotal !== 1 ? 's' : ''}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => loadMiRecords(miRecordsPage)} disabled={miRecordsLoading}
                    className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${miRecordsLoading ? 'animate-spin' : ''}`} /> Refresh
                  </Button>
                </div>

                {miRecordsLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="animate-pulse flex gap-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 space-y-2"><div className="h-3 bg-gray-200 rounded w-1/3" /><div className="h-2.5 bg-gray-200 rounded w-1/2" /></div>
                      </div>
                    ))}
                  </div>
                ) : miRecords.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <Inbox className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm text-gray-500">No inward receipts yet</p>
                    <p className="text-xs text-gray-400 mt-1">Search a JWO challan above to create one</p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Challan No</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">JWO Challan</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Date</th>
                            <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs">Type</th>
                            <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Party</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">FG (Kg)</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Waste (Kg)</th>
                            <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Rejection (Kg)</th>
                            <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {miRecords.map((rec, idx) => (
                            <tr key={rec.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50`}>
                              <td className="px-3 py-2.5 text-xs font-medium">{rec.challan_no || "-"}</td>
                              <td className="px-3 py-2.5 text-xs font-mono">{rec.jwo_challan}</td>
                              <td className="px-3 py-2.5 text-xs whitespace-nowrap">{rec.receipt_date}</td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge variant="outline" className={`text-[9px] font-semibold ${rec.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                                  {rec.receipt_type === 'final' ? 'Final' : 'Partial'}
                                </Badge>
                              </td>
                              <td className="px-3 py-2.5 text-xs truncate max-w-[120px]" title={rec.to_party}>{rec.to_party || "-"}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-emerald-700">{rec.total_fg_kgs.toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-orange-700">{rec.total_waste_kgs.toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-right text-xs font-medium text-rose-700">{rec.total_rejection_kgs.toFixed(2)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="sm" title="View Details"
                                    onClick={() => handleViewIR(rec.id)}
                                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  {canDelete && (
                                    <Button variant="ghost" size="sm" title="Delete"
                                      onClick={() => handleDeleteMiRecord(rec.id, rec.challan_no || rec.ir_number)}
                                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="sm:hidden p-3 space-y-2">
                      {miRecords.map((rec) => (
                        <div key={rec.id} className="bg-white border rounded-lg p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{rec.challan_no || "-"}</span>
                            <Badge variant="outline" className={`text-[9px] font-semibold ${rec.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                              {rec.receipt_type === 'final' ? 'Final' : 'Partial'}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">JWO: {rec.jwo_challan} | {rec.receipt_date}</div>
                          <div className="text-xs text-gray-500">{rec.to_party || "-"}</div>
                          <div className="flex items-center justify-between text-xs">
                            <span>FG: <span className="font-medium text-emerald-700">{rec.total_fg_kgs.toFixed(2)}</span> | W: <span className="font-medium text-orange-700">{rec.total_waste_kgs.toFixed(2)}</span> | R: <span className="font-medium text-rose-700">{rec.total_rejection_kgs.toFixed(2)}</span></span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm"
                                onClick={() => handleViewIR(rec.id)}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800">
                                <Eye className="h-3 w-3" />
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm"
                                  onClick={() => handleDeleteMiRecord(rec.id, rec.challan_no || rec.ir_number)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {miRecordsTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
                        <p className="text-xs text-muted-foreground">
                          Page {miRecordsPage} of {miRecordsTotalPages} ({miRecordsTotal} total)
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => loadMiRecords(miRecordsPage - 1)} disabled={miRecordsPage === 1} className="h-8 px-3 text-xs">Prev</Button>
                          <Button variant="outline" size="sm" onClick={() => loadMiRecords(miRecordsPage + 1)} disabled={miRecordsPage >= miRecordsTotalPages} className="h-8 px-3 text-xs">Next</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            )}

            {/* ─── Found Record Summary ─── */}
            {miFoundRecord && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-emerald-50 to-green-50 border-b">
                  <CardTitle className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    JWO Found — {miFoundRecord.challan_no}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  {/* JWO Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs mb-4">
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Date</span>
                      <span className="font-medium">{miFoundRecord.job_work_date || "-"}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Vendor</span>
                      <span className="font-medium">{miFoundRecord.to_party || "-"}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Process</span>
                      <span className="font-medium">{processType || "-"}</span>
                    </div>
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-2.5">
                      <span className="text-teal-600 block">Material-In Warehouse</span>
                      <span className="font-semibold text-teal-900">{miFoundRecord.from_warehouse || "-"}</span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <span className="text-gray-500 block">Status</span>
                      <span className="font-medium">
                        {miFoundRecord.status === 'sent' ? 'Open (no receives)' :
                          miFoundRecord.status === 'partially_received' ? `Partially Received (${miReceiveCount} IR${miReceiveCount > 1 ? 's' : ''})` :
                            miFoundRecord.status}
                      </span>
                    </div>
                  </div>

                  {/* Running Totals Panel (if previous receives exist) */}
                  {miReceiveCount > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                      <h4 className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5" /> Cumulative Summary (from {miReceiveCount} prior IR{miReceiveCount > 1 ? 's' : ''})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs mb-3">
                        <div><span className="text-blue-600">Total Dispatched:</span> <span className="font-semibold">{totals.sent_kgs.toFixed(2)} kg</span></div>
                        <div><span className="text-blue-600">FG Received:</span> <span className="font-semibold">{totals.prev_fg.toFixed(2)} kg</span></div>
                        {showWasteColumn && <div><span className="text-blue-600">Waste Received:</span> <span className="font-semibold">{totals.prev_waste.toFixed(2)} kg</span></div>}
                        <div><span className="text-blue-600">Rejection:</span> <span className="font-semibold">{totals.prev_rejection.toFixed(2)} kg</span></div>
                        <div><span className="text-blue-600">Remaining Balance:</span> <span className="font-semibold">{(totals.sent_kgs - totals.prev_fg - totals.prev_waste - totals.prev_rejection).toFixed(2)} kg</span></div>
                      </div>

                      {/* Prior IR History */}
                      {miPriorIRs.length > 0 && (
                        <div className="border-t border-blue-200 pt-2 mt-2">
                          <h5 className="text-[10px] font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Receipt History</h5>
                          <div className="space-y-1">
                            {miPriorIRs.map((ir, idx) => (
                              <div key={idx} className="flex items-center gap-3 text-[11px] bg-white/60 rounded px-2 py-1.5">
                                <span className="font-semibold text-blue-800 min-w-[80px]">{ir.challan_no || "-"}</span>
                                <span className="text-gray-500 min-w-[75px]">{ir.receipt_date || "-"}</span>
                                <Badge variant="outline" className={`text-[9px] ${ir.receipt_type === 'final' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-blue-200 text-blue-600'}`}>
                                  {ir.receipt_type === 'final' ? 'Final' : 'Partial'}
                                </Badge>
                                <span className="text-gray-600 ml-auto">
                                  FG: {ir.total_fg_kgs.toFixed(2)}
                                  {ir.total_waste_kgs > 0 && ` | W: ${ir.total_waste_kgs.toFixed(2)}`}
                                  {ir.total_rejection_kgs > 0 && ` | R: ${ir.total_rejection_kgs.toFixed(2)}`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Loss Config Info */}
                  {miLossConfig && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800">
                      <span className="font-semibold">Expected Loss:</span> {miLossConfig.min_loss_pct}% – {miLossConfig.max_loss_pct}%
                      {miLossConfig.loss_component && <span className="ml-2 text-amber-600">({miLossConfig.loss_component})</span>}
                      {miLossConfig.single_shot && <Badge variant="outline" className="ml-2 text-[9px] border-amber-300 text-amber-700">Single-Shot Return</Badge>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── Challan No, Receipt Type & Date ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardContent className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Inward Challan No *</Label>
                      <Input value={miChallanNo}
                        onChange={(e) => setMiChallanNo(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Enter inward challan no" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Receipt Date</Label>
                      <Input type="date" value={(() => {
                        const parts = miReceiptDate.split('-')
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : miReceiptDate
                      })()}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) {
                            const [y, m, d] = val.split('-')
                            setMiReceiptDate(`${d}-${m}-${y}`)
                          }
                        }}
                        className="h-9 bg-white border-gray-200" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Items Table ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="h-4 w-4 text-amber-600" />
                    Inward Receipt — Enter Quantities
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Enter Finished Goods{showWasteColumn ? `, ${wasteLabel}` : ''}, and Rejection quantities. Unaccounted loss is auto-calculated.
                  </p>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">#</th>
                          <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Item Description</th>
                          <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Dispatched (Kg)</th>
                          <th className="px-3 py-2.5 text-right font-medium text-emerald-700 text-xs bg-emerald-50">FG Received (Kg)</th>
                          {showWasteColumn && (
                            <th className="px-3 py-2.5 text-right font-medium text-orange-700 text-xs bg-orange-50">{wasteLabel} (Kg)</th>
                          )}
                          <th className="px-3 py-2.5 text-right font-medium text-rose-700 text-xs bg-rose-50">Rejection (Kg)</th>
                          <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Accounted (Kg)</th>
                          <th className="px-3 py-2.5 text-right font-medium text-red-600 text-xs">Unaccounted (Kg)</th>
                          <th className="px-3 py-2.5 text-right font-medium text-red-600 text-xs">Loss %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {miItems.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-2 text-gray-500 text-xs">{item.sl_no}</td>
                            <td className="px-3 py-2 font-medium text-xs max-w-[180px] truncate" title={item.description}>{item.description}</td>
                            <td className="px-3 py-2 text-right text-xs font-medium">{item.sent_kgs.toFixed(2)}</td>
                            {/* FG Received */}
                            <td className="px-3 py-2 text-right bg-emerald-50/30">
                              <Input type="number" step="0.01" min="0" value={item.fg_kgs || ""}
                                onChange={(e) => updateIRItem(idx, 'fg_kgs', Number(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-24 text-xs text-right inline-block border-emerald-200 focus:border-emerald-400" />
                            </td>
                            {/* Waste */}
                            {showWasteColumn && (
                              <td className="px-3 py-2 text-right bg-orange-50/30">
                                <Input type="number" step="0.01" min="0" value={item.waste_kgs || ""}
                                  onChange={(e) => updateIRItem(idx, 'waste_kgs', Number(e.target.value) || 0)}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  className="h-7 w-24 text-xs text-right inline-block border-orange-200 focus:border-orange-400" />
                              </td>
                            )}
                            {/* Rejection */}
                            <td className="px-3 py-2 text-right bg-rose-50/30">
                              <Input type="number" step="0.01" min="0" value={item.rejection_kgs || ""}
                                onChange={(e) => updateIRItem(idx, 'rejection_kgs', Number(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-24 text-xs text-right inline-block border-rose-200 focus:border-rose-400" />
                            </td>
                            {/* Accounted */}
                            <td className="px-3 py-2 text-right text-xs font-medium text-gray-700">{item.total_accounted_kgs.toFixed(2)}</td>
                            {/* Unaccounted */}
                            <td className={`px-3 py-2 text-right text-xs font-semibold ${item.unaccounted_kgs > 0 ? 'text-red-600' : item.unaccounted_kgs < 0 ? 'text-red-800' : 'text-gray-400'}`}>
                              {item.unaccounted_kgs.toFixed(2)}
                              {item.unaccounted_kgs < 0 && <span className="text-[9px] ml-0.5">OVER</span>}
                            </td>
                            {/* Loss % */}
                            <td className="px-3 py-2 text-right">
                              <Badge variant="outline" className={`text-[10px] font-semibold ${
                                item.loss_pct > 10 ? 'bg-red-50 text-red-700 border-red-200' :
                                item.loss_pct > 5 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                item.loss_pct >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-red-100 text-red-800 border-red-300'
                              }`}>
                                {item.loss_pct.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-100 border-t-2">
                        <tr className="font-semibold text-xs">
                          <td colSpan={2} className="px-3 py-2.5 text-gray-700">Totals (Cumulative)</td>
                          <td className="px-3 py-2.5 text-right">{totals.sent_kgs.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700">{(totals.prev_fg + totals.this_fg).toFixed(2)}</td>
                          {showWasteColumn && <td className="px-3 py-2.5 text-right text-orange-700">{(totals.prev_waste + totals.this_waste).toFixed(2)}</td>}
                          <td className="px-3 py-2.5 text-right text-rose-700">{(totals.prev_rejection + totals.this_rejection).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700">{(totals.sent_kgs - totals.unaccounted).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right text-red-600">{totals.unaccounted.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <Badge variant="outline" className="text-[10px] font-bold bg-gray-200 text-gray-800 border-gray-400">{overallLossPct.toFixed(1)}%</Badge>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Loss Tolerance Alert (Final Receipt only) ─── */}
            {toleranceStatus && miItems.some(i => i.fg_kgs > 0 || i.waste_kgs > 0 || i.rejection_kgs > 0) && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium ${toleranceStatus.color}`}>
                {toleranceStatus.status === "normal" ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                <span>Loss Tolerance: {overallLossPct.toFixed(1)}% — {toleranceStatus.label}</span>
                {miLossConfig && <span className="ml-auto text-[10px] opacity-75">Expected: {miLossConfig.min_loss_pct}% – {miLossConfig.max_loss_pct}%</span>}
              </div>
            )}

            {/* ─── Vehicle & Remarks ─── */}
            {miItems.length > 0 && (
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b">
                  <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-violet-600" />
                    Return Transport Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Vehicle No</Label>
                      <Input value={miVehicleNo} onChange={(e) => setMiVehicleNo(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="e.g. MH43BP5470" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Driver Name</Label>
                      <Input value={miDriverName} onChange={(e) => setMiDriverName(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Driver name" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Remarks</Label>
                      <Input value={miRemarks} onChange={(e) => setMiRemarks(e.target.value)}
                        className="h-9 bg-white border-gray-200" placeholder="Notes about this return" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── Placeholder when no record ─── */}
            {!miFoundRecord && (
              <Card className="border border-dashed border-gray-300">
                <CardContent className="py-12">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                      <Search className="h-7 w-7 text-teal-300" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">Search for a Material Out Record</h3>
                    <p className="text-xs text-gray-500 max-w-sm">
                      Enter the challan number above and click Find Record. The original dispatched items will load
                      and you can enter received quantities (FG, Waste, Rejection) for this inward receipt.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}


          </form>

          {/* ═══════════════════════════════════════════════ */}
          {/*  ARTICLE ENTRY — Box ID + QR Label Generation  */}
          {/* ═══════════════════════════════════════════════ */}
          {miFoundRecord && (
          <Card className="border-0 shadow-sm overflow-hidden mt-4">
            <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                <Box className="h-4 w-4 text-indigo-600" />
                Article Entry — Generate Box IDs & QR Labels
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Select item, enter quantity to auto-generate box entries with transaction number and printable QR labels
              </p>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Label className="text-xs font-medium text-gray-600 mb-1 block">Search Item Description</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    value={aeSearchText}
                    onChange={(e) => setAeSearchText(e.target.value)}
                    onFocus={() => { if (aeSearchResults.length > 0) setAeSearchOpen(true) }}
                    onBlur={() => setTimeout(() => setAeSearchOpen(false), 200)}
                    className="h-9 pl-8 bg-white border-gray-200 text-xs"
                    placeholder="Type to search item description..."
                  />
                  {aeSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 animate-spin" />}
                </div>
                {aeSearchOpen && aeSearchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {aeSearchResults.map((item, idx) => (
                      <button key={idx} type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleAeSearchSelect(item) }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 border-b last:border-0 transition-colors">
                        <div className="text-xs font-medium text-gray-900 truncate">{item.item_description}</div>
                        <div className="text-[10px] text-gray-500">{item.item_group} / {item.sub_group}</div>
                      </button>
                    ))}
                  </div>
                )}
                {aeSearchOpen && aeSearchResults.length === 0 && aeSearchText.trim().length >= 2 && !aeSearching && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-500 text-center">
                    No items found
                  </div>
                )}
              </div>

              {/* Selected item display */}
              {aeSelectedDesc && (
                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <Package className="h-3.5 w-3.5 text-indigo-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-indigo-900 truncate block">{aeSelectedDesc}</span>
                    <span className="text-[10px] text-indigo-600">{aeSelectedGroup} / {aeSelectedSubGroup}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setAeSelectedGroup(""); setAeSelectedSubGroup(""); setAeSelectedDesc(""); setAeSubGroups([]); setAeDescriptions([]) }}
                    className="h-6 w-6 p-0 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 flex-shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {/* Cascading Dropdowns (alternative to search) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Item Group */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Item Group *</Label>
                  <Select value={aeSelectedGroup} onValueChange={handleAeGroupChange}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingGroups ? "Loading..." : "Select Group"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeItemGroups.map(g => (
                        <SelectItem key={g} value={g} className="text-xs">{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Sub Group */}
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Sub Group *</Label>
                  <Select value={aeSelectedSubGroup} onValueChange={handleAeSubGroupChange} disabled={!aeSelectedGroup}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingSubs ? "Loading..." : "Select Sub Group"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeSubGroups.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Item Description */}
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs font-medium text-gray-600">Item Description *</Label>
                  <Select value={aeSelectedDesc} onValueChange={setAeSelectedDesc} disabled={!aeSelectedSubGroup}>
                    <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                      <SelectValue placeholder={aeLoadingDescs ? "Loading..." : "Select Description"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {aeDescriptions.map(d => (
                        <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Quantity + Net Weight + Gross Weight */}
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="space-y-1 w-full sm:w-32">
                  <Label className="text-xs font-medium text-gray-600">Quantity (Boxes) *</Label>
                  <Input type="number" min={1} value={aeQuantity || ""}
                    onChange={(e) => setAeQuantity(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="No. of boxes" />
                </div>
                <div className="space-y-1 w-full sm:w-32">
                  <Label className="text-xs font-medium text-gray-600">Net Wt / Box (Kg)</Label>
                  <Input type="number" step="0.01" min={0} value={aeNetWeight || ""}
                    onChange={(e) => setAeNetWeight(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="Net wt" />
                </div>
                <div className="space-y-1 w-full sm:w-32">
                  <Label className="text-xs font-medium text-gray-600">Gross Wt / Box (Kg)</Label>
                  <Input type="number" step="0.01" min={0} value={aeGrossWeight || ""}
                    onChange={(e) => setAeGrossWeight(Number(e.target.value) || 0)}
                    onWheel={(e) => e.currentTarget.blur()}
                    className="h-9 bg-white border-gray-200 text-xs" placeholder="Gross wt" />
                </div>
              </div>

              {/* Cold Storage Fields — shown when warehouse is cold storage */}
              {isColdStorageInward && (
                <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Cold Storage Details
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Company *</Label>
                      <Select value={aeColdCompany} onValueChange={setAeColdCompany}>
                        <SelectTrigger className="h-9 bg-white border-gray-200 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cfpl" className="text-xs">CFPL</SelectItem>
                          <SelectItem value="cdpl" className="text-xs">CDPL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Inward Date *</Label>
                      <Input type="date" value={(() => {
                        const parts = aeInwardDate.split('-')
                        return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : aeInwardDate
                      })()}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) { const [y, m, d] = val.split('-'); setAeInwardDate(`${d}-${m}-${y}`) }
                        }}
                        className="h-9 bg-white border-gray-200 text-xs" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Vakkal</Label>
                      <Input value={aeVakkal} onChange={(e) => setAeVakkal(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Vakkal" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Lot No</Label>
                      <Input value={aeLotNo} onChange={(e) => setAeLotNo(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Lot number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Item Mark</Label>
                      <Input value={aeItemMark} onChange={(e) => setAeItemMark(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Item mark" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Storage Location</Label>
                      <Input value={aeStorageLocation} onChange={(e) => setAeStorageLocation(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Location" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Exporter</Label>
                      <Input value={aeExporter} onChange={(e) => setAeExporter(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Exporter" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Rate</Label>
                      <Input type="number" step="0.01" min={0} value={aeRate || ""}
                        onChange={(e) => setAeRate(Number(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Value (Qty × Rate)</Label>
                      <div className="h-9 flex items-center px-3 bg-gray-50 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                        {aeQuantity > 0 && aeRate > 0 ? (aeQuantity * aeRate).toFixed(2) : "—"}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Spl. Remarks</Label>
                      <Input value={aeSplRemarks} onChange={(e) => setAeSplRemarks(e.target.value)}
                        className="h-9 bg-white border-gray-200 text-xs" placeholder="Special remarks..." />
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="flex items-end">
                <Button type="button" onClick={generateArticleEntries}
                  disabled={!aeSelectedDesc || aeQuantity < 1}
                  className="h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs w-full sm:w-auto">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate Entries
                </Button>
              </div>

              {/* Generated Articles Table */}
              {aeGeneratedArticles.length > 0 && (
                <>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700">{aeGeneratedArticles.length} Box Entries Generated</h4>
                      <p className="text-[10px] text-gray-500">
                        {[...new Set(aeGeneratedArticles.map(a => a.transaction_no))].length} transaction(s)
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setAeGeneratedArticles([])}
                        className="h-8 px-3 text-xs text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50">
                        <Trash2 className="h-3 w-3 mr-1.5" /> Clear All
                      </Button>
                      <Button type="button" size="sm" onClick={() => handlePrintArticleQR()} disabled={aePrintingQR}
                        className="h-8 px-4 text-xs bg-violet-600 hover:bg-violet-700 text-white">
                        {aePrintingQR ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Printer className="h-3.5 w-3.5 mr-1.5" />}
                        Print QR Labels
                      </Button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">#</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Transaction No</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Box ID</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Item Description</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 text-xs">Group</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">Net Wt (Kg)</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 text-xs">Gross Wt (Kg)</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600 text-xs">QR</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-600 text-xs">Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aeGeneratedArticles.map((art, idx) => (
                          <tr key={`${art.box_id}-${idx}`} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                            <td className="px-3 py-1.5 text-xs text-gray-500">{idx + 1}</td>
                            <td className="px-3 py-1.5 text-xs font-mono text-indigo-700">{art.transaction_no}</td>
                            <td className="px-3 py-1.5 text-xs font-mono font-semibold">{art.box_id}</td>
                            <td className="px-3 py-1.5 text-xs truncate max-w-[200px]" title={art.item_description}>{art.item_description}</td>
                            <td className="px-3 py-1.5 text-xs text-gray-600">{art.item_group} / {art.sub_group}</td>
                            <td className="px-2 py-1">
                              <Input type="number" step="0.01" min={0}
                                value={art.net_weight || ""}
                                onChange={(e) => setAeGeneratedArticles(prev => prev.map((a, i) => i === idx ? { ...a, net_weight: Number(e.target.value) || 0 } : a))}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-20 text-xs text-right border-gray-200" />
                            </td>
                            <td className="px-2 py-1">
                              <Input type="number" step="0.01" min={0}
                                value={art.gross_weight || ""}
                                onChange={(e) => setAeGeneratedArticles(prev => prev.map((a, i) => i === idx ? { ...a, gross_weight: Number(e.target.value) || 0 } : a))}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="h-7 w-20 text-xs text-right border-gray-200" />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <Button type="button" variant="ghost" size="sm" title="Print QR Label"
                                onClick={() => handlePrintArticleQR(idx)} disabled={aePrintingQR}
                                className="h-7 w-7 p-0 text-violet-600 hover:text-violet-800 hover:bg-violet-50">
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <Button type="button" variant="ghost" size="sm"
                                onClick={() => setAeGeneratedArticles(prev => prev.filter((_, i) => i !== idx))}
                                className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Total Net Wt vs FG Received indicator */}
                  {aeFgLimit > 0 && (
                    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${
                      aeTotalNetWeight > aeFgLimit + 0.01
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : Math.abs(aeTotalNetWeight - aeFgLimit) < 0.01
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      <span>Total Box Net Wt: <b>{aeTotalNetWeight.toFixed(2)} kg</b> / FG Received: <b>{aeFgLimit.toFixed(2)} kg</b></span>
                      <span>{aeTotalNetWeight > aeFgLimit + 0.01 ? 'EXCEEDS LIMIT' : Math.abs(aeTotalNetWeight - aeFgLimit) < 0.01 ? 'Matched' : `Remaining: ${(aeFgLimit - aeTotalNetWeight).toFixed(2)} kg`}</span>
                    </div>
                  )}

                  {/* Add Box at bottom */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => {
                        if (aeGeneratedArticles.length === 0) return
                        const last = aeGeneratedArticles[aeGeneratedArticles.length - 1]
                        const newBoxNum = Math.max(...aeGeneratedArticles.filter(a => a.transaction_no === last.transaction_no).map(a => a.box_number)) + 1
                        const base = last.box_id.split('-')[0]
                        setAeGeneratedArticles(prev => [...prev, {
                          ...last,
                          box_id: `${base}-${newBoxNum}`,
                          box_number: newBoxNum,
                          net_weight: 0,
                          gross_weight: 0,
                        }])
                      }}
                      disabled={aeGeneratedArticles.length === 0}
                      className="h-8 px-4 text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                      <Plus className="h-3 w-3 mr-1.5" /> Add Box
                    </Button>
                    <span className="text-[10px] text-gray-400">
                      Adds a new box to the last transaction
                    </span>
                  </div>

                </>
              )}
            </CardContent>
          </Card>
          )}

          {/* ─── Submit (Moved to Bottom) ─── */}
          {miItems.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => {
                setMiFoundRecord(null); setMiItems([]); setMiSearchChallan(""); setMiChallanNo(""); setMiLossConfig(null); setMiReceiveCount(0); setMiPriorIRs([])
              }} className="h-10 px-5 text-sm">Clear</Button>
              <div className="flex items-center gap-3">
                <Button type="button" disabled={miSubmitting}
                  onClick={(e) => handleSubmitMaterialIn(e as any, "partial")}
                  className="h-10 px-5 text-sm shadow-sm bg-teal-600 hover:bg-teal-700 text-white">
                  {miSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> :
                    <><Inbox className="h-4 w-4 mr-2" />Submit Partial</>}
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <Button type="button" disabled={miSubmitting || !isFullyAccounted}
                    onClick={(e) => handleSubmitMaterialIn(e as any, "final")}
                    className="h-10 px-5 text-sm shadow-sm bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!isFullyAccounted ? `Dispatched (${totals.sent_kgs.toFixed(2)} kg) ≠ Accounted (${totalAccountedKgs.toFixed(2)} kg)` : ''}>
                    {miSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> :
                      <><AlertTriangle className="h-4 w-4 mr-2" />Submit Final</>}
                  </Button>
                  {!isFullyAccounted && miItems.length > 0 && (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Dispatched: {totals.sent_kgs.toFixed(2)} kg | Accounted: {totalAccountedKgs.toFixed(2)} kg
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

        </TabsContent>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: ALL RECORDS                          */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="records" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 sm:px-5 py-3 sm:py-4 border-b bg-white">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Job Work Records</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{recordsTotal} record{recordsTotal !== 1 ? 's' : ''}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => loadRecords(recordsPage)} disabled={recordsLoading}
                className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground self-end sm:self-auto">
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${recordsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 px-4 sm:px-5 py-3 border-b bg-gray-50/50">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Search challan no..."
                  value={recordsFilterChallan}
                  onChange={(e) => setRecordsFilterChallan(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadRecords(1) }}
                  className="h-8 pl-8 text-xs bg-white"
                />
              </div>
              <Select value={recordsFilterStatus} onValueChange={(v) => setRecordsFilterStatus(v)}>
                <SelectTrigger className="h-8 w-full sm:w-[160px] text-xs bg-white">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="sent">Material Out</SelectItem>
                  <SelectItem value="partially_received">Partial Return</SelectItem>
                  <SelectItem value="fully_received">Fully Received</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={recordsFilterDate}
                onChange={(e) => setRecordsFilterDate(e.target.value)}
                className="h-8 w-full sm:w-[150px] text-xs bg-white"
              />
              {(recordsFilterChallan || recordsFilterStatus !== "all" || recordsFilterDate) && (
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-gray-500"
                  onClick={() => { setRecordsFilterChallan(""); setRecordsFilterStatus("all"); setRecordsFilterDate(""); }}>
                  Clear
                </Button>
              )}
            </div>

            {recordsLoading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse flex items-center gap-4 p-4 rounded-lg bg-gray-50">
                    <div className="h-10 w-10 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-2.5 bg-gray-200 rounded w-1/2" />
                    </div>
                    <div className="h-6 w-16 bg-gray-200 rounded-full" />
                  </div>
                ))}
              </div>
            ) : records.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16">
                <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <ClipboardList className="h-7 w-7 text-gray-400" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1">No job work records yet</h3>
                <p className="text-xs sm:text-sm text-gray-500 text-center max-w-xs mb-4">
                  Create your first material out to start tracking outsourced processing.
                </p>
                <Button size="sm" onClick={() => router.push(`/${company}/transfer/job-work/material-out`)} className="bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> New Material Out
                </Button>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Challan No</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Status</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">From → To</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Item Description</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 text-xs">Date</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">Total Qty</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-600 text-xs">Total Wt (Kg)</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600 text-xs">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((rec, idx) => (
                        <tr key={rec.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-50`}>
                          <td className="px-4 py-3 font-mono text-xs font-medium">
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-default underline decoration-dotted underline-offset-2">{rec.challan_no}</span>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  sideOffset={6}
                                  className="!bg-gradient-to-br !from-sky-50 !via-indigo-50 !to-violet-100 !text-slate-800 border border-indigo-200/70 shadow-lg shadow-indigo-200/40 rounded-lg max-w-xs text-xs p-3 space-y-1.5"
                                >
                                  <div className="font-semibold text-indigo-900 pb-1 border-b border-indigo-200/60">{rec.challan_no}</div>
                                  <div><span className="font-semibold text-indigo-700">From → To:</span> <span className="text-slate-700">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</span></div>
                                  {rec.item_descriptions && (
                                    <div><span className="font-semibold text-indigo-700">Items:</span> <span className="text-slate-700">{rec.item_descriptions}</span></div>
                                  )}
                                  {rec.remarks && (
                                    <div><span className="font-semibold text-indigo-700">Reason:</span> <span className="text-slate-700">{rec.remarks}</span></div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(rec.status)}</td>
                          <td className="px-4 py-3 text-xs">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</td>
                          <td className="px-4 py-3 text-xs max-w-[250px] truncate" title={rec.item_descriptions}>{rec.item_descriptions || "-"}</td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">{rec.job_work_date}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium">{rec.total_qty}</td>
                          <td className="px-4 py-3 text-right text-xs font-medium">{rec.total_weight.toFixed(2)}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {(rec.status === 'sent' || rec.status === 'partially_received') && (
                                <Button variant="ghost" size="sm" title="Add Stock (Material In)"
                                  onClick={() => handleAddStock(rec.challan_no)}
                                  className="h-7 w-7 p-0 text-teal-600 hover:text-teal-800 hover:bg-teal-50">
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" title="Edit"
                                onClick={() => router.push(`/${company}/transfer/job-work/material-out?edit=${rec.id}`)}
                                className="h-7 w-7 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" title="DC Print"
                                onClick={() => router.push(`/${company}/transfer/job-work/dc/${rec.challan_no}`)}
                                className="h-7 w-7 p-0 text-violet-600 hover:text-violet-800 hover:bg-violet-50">
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                              {canDelete && (
                                <Button variant="ghost" size="sm" title="Delete"
                                  onClick={() => handleDeleteRecord(rec.id, rec.challan_no)}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="sm:hidden p-3 space-y-3">
                  {records.map((rec) => (
                    <div key={rec.id} className="bg-white border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-semibold">{rec.challan_no}</span>
                        {getStatusBadge(rec.status)}
                      </div>
                      <div className="text-xs text-gray-600">{getDisplayWarehouseName(rec.from_warehouse)} → {rec.to_party}</div>
                      {rec.item_descriptions && (
                        <div className="text-xs text-gray-700 truncate">{rec.item_descriptions}</div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{rec.job_work_date}</span>
                        <span>Qty: {rec.total_qty} | Wt: {rec.total_weight.toFixed(2)} kg</span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 border-t flex-wrap">
                        {(rec.status === 'sent' || rec.status === 'partially_received') && (
                          <Button variant="outline" size="sm"
                            onClick={() => handleAddStock(rec.challan_no)}
                            className="h-7 px-2.5 text-[10px] text-teal-600 border-teal-200">
                            <Plus className="h-3 w-3 mr-1" /> Add Stock
                          </Button>
                        )}
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/job-work/material-out?edit=${rec.id}`)}
                          className="h-7 px-2.5 text-[10px] text-blue-600 border-blue-200">
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button variant="outline" size="sm"
                          onClick={() => router.push(`/${company}/transfer/job-work/dc/${rec.challan_no}`)}
                          className="h-7 px-2.5 text-[10px] text-violet-600 border-violet-200">
                          <Printer className="h-3 w-3 mr-1" /> DC Print
                        </Button>
                        {canDelete && (
                          <Button variant="outline" size="sm"
                            onClick={() => handleDeleteRecord(rec.id, rec.challan_no)}
                            className="h-7 px-2.5 text-[10px] text-red-500 border-red-200">
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {recordsTotalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-t bg-gray-50/50 gap-2">
                    <p className="text-xs text-muted-foreground">
                      Showing {((recordsPage - 1) * 15) + 1}-{Math.min(recordsPage * 15, recordsTotal)} of {recordsTotal}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => loadRecords(recordsPage - 1)} disabled={recordsPage === 1} className="h-8 px-3 text-xs">Prev</Button>
                      <span className="text-xs font-medium text-gray-700 tabular-nums">{recordsPage} / {recordsTotalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => loadRecords(recordsPage + 1)} disabled={recordsPage === recordsTotalPages} className="h-8 px-3 text-xs">Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════ */}
        {/*  TAB: REPORTS / DASHBOARD                  */}
        {/* ══════════════════════════════════════════ */}
        <TabsContent value="reports" className="mt-4 space-y-4">

          {/* ─── Filters ─── */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-indigo-600" />
                  Filters
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => {
                    setRptFilterProcess(""); setRptFilterVendor(""); setRptFilterItem(""); setRptFilterFrom(""); setRptFilterTo("")
                  }} className="h-8 px-3 text-xs text-gray-500">
                    Clear All
                  </Button>
                  {rptLoading && <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Process</Label>
                  <Select value={rptFilterProcess} onValueChange={setRptFilterProcess}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Processes" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Processes</SelectItem>
                      {rptFilterOpts.sub_categories.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Vendor</Label>
                  <Select value={rptFilterVendor} onValueChange={setRptFilterVendor}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Vendors" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vendors</SelectItem>
                      {rptFilterOpts.vendors.map((v: string) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Item</Label>
                  <Select value={rptFilterItem} onValueChange={setRptFilterItem}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Items" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Items</SelectItem>
                      {rptFilterOpts.items.map((i: string) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">From Date</Label>
                  <Input type="date" value={rptFilterFrom} onChange={(e) => setRptFilterFrom(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">To Date</Label>
                  <Input type="date" value={rptFilterTo} onChange={(e) => setRptFilterTo(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </CardContent>
          </Card>

          {rptLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : rptData ? (
            <>
              {/* ─── KPI Cards ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {[
                  { label: "Total JWOs", value: rptSummary.total_jwo, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Dispatched", value: `${(rptSummary.total_dispatched_kgs || 0).toLocaleString()} kg`, icon: Send, color: "text-indigo-600", bg: "bg-indigo-50" },
                  { label: "FG Received", value: `${(rptSummary.total_fg_kgs || 0).toLocaleString()} kg`, icon: Package, color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Waste + Rejection", value: `${((rptSummary.total_waste_kgs || 0) + (rptSummary.total_rejection_kgs || 0)).toLocaleString()} kg`, icon: Trash2, color: "text-orange-600", bg: "bg-orange-50" },
                  { label: "Overall Loss", value: `${rptSummary.overall_loss_pct || 0}%`, icon: TrendingUp, color: rptSummary.overall_loss_pct > 10 ? "text-red-600" : "text-emerald-600", bg: rptSummary.overall_loss_pct > 10 ? "bg-red-50" : "bg-emerald-50" },
                ].map((kpi, idx) => (
                  <Card key={idx} className="border-0 shadow-sm">
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`h-7 w-7 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                          <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                        </div>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-gray-900">{kpi.value}</p>
                      <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* ─── Status Distribution ─── */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-indigo-500" /> Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(rptStatusCounts).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-2">
                        {getStatusBadge(status)}
                        <span className="text-sm font-bold text-gray-800 ml-1">{count as number}</span>
                      </div>
                    ))}
                    {Object.keys(rptStatusCounts).length === 0 && <p className="text-xs text-gray-400">No data</p>}
                  </div>
                </CardContent>
              </Card>

              {/* ─── Sub-view Tabs ─── */}
              <div className="flex flex-wrap gap-1.5 bg-gray-100 rounded-lg p-1">
                {[
                  { key: "process" as const, label: "By Process", icon: Layers },
                  { key: "vendor" as const, label: "By Vendor", icon: Users },
                  { key: "item" as const, label: "By Item", icon: Box },
                  { key: "trend" as const, label: "Monthly Trend", icon: TrendingUp },
                  { key: "matrix" as const, label: "Vendor × Item", icon: BarChart3 },
                ].map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setRptActiveView(key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      rptActiveView === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    <Icon className="h-3 w-3" />{label}
                  </button>
                ))}
              </div>

              {/* ─── By Process ─── */}
              {rptActiveView === "process" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Process Type Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Process</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">FG Received (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rptByProcess.map((r: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold">{r.process}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium text-emerald-700">{r.fg_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByProcess[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {rptByProcess.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── By Vendor ─── */}
              {rptActiveView === "vendor" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Vendor Breakdown ({rptSummary.unique_vendors} vendors)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Vendor</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rptByVendor.map((r: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold max-w-[200px] truncate" title={r.vendor}>{r.vendor}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-teal-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByVendor[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {rptByVendor.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── By Item ─── */}
              {rptActiveView === "item" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Item Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Boxes</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[200px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rptByItem.map((r: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-semibold max-w-[200px] truncate" title={r.item}>{r.item}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.total_boxes}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptByItem[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {rptByItem.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── Monthly Trend ─── */}
              {rptActiveView === "trend" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Monthly Trend (Last 12 months)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    {rptMonthly.length > 0 ? (
                      <div className="space-y-2">
                        {rptMonthly.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-xs font-mono font-medium text-gray-600 w-[60px]">{m.month}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-indigo-600 rounded-full transition-all flex items-center justify-end pr-2"
                                style={{ width: `${barWidth(m.dispatched_kgs, Math.max(...rptMonthly.map((x: any) => x.dispatched_kgs)))}%` }}>
                                <span className="text-[10px] font-semibold text-white">{m.dispatched_kgs.toLocaleString()} kg</span>
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 w-[50px] text-right">{m.jwo_count} JWO{m.jwo_count !== 1 ? 's' : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-xs text-gray-400 py-8">No monthly data available</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* ─── Vendor × Item Matrix ─── */}
              {rptActiveView === "matrix" && (
                <Card className="border-0 shadow-sm overflow-hidden">
                  <CardHeader className="pb-2 pt-4 px-4 border-b">
                    <CardTitle className="text-sm font-semibold text-gray-800">Vendor × Item Matrix (Top 20 combinations)</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Vendor</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600">Item</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">JWOs</th>
                          <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600">Dispatched (Kg)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 w-[150px]">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rptVendorItem.map((r: any, idx: number) => (
                          <tr key={idx} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                            <td className="px-4 py-2.5 text-xs font-medium max-w-[150px] truncate" title={r.vendor}>{r.vendor}</td>
                            <td className="px-4 py-2.5 text-xs max-w-[150px] truncate" title={r.item}>{r.item}</td>
                            <td className="px-4 py-2.5 text-right text-xs">{r.jwo_count}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-medium">{r.dispatched_kgs.toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-violet-500 h-2 rounded-full transition-all" style={{ width: `${barWidth(r.dispatched_kgs, rptVendorItem[0]?.dispatched_kgs || 1)}%` }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                        {rptVendorItem.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-xs text-gray-400">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}

              {/* ─── Inward Summary Panel ─── */}
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4 border-b">
                  <CardTitle className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Inbox className="h-4 w-4 text-teal-600" /> Inward Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-teal-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-teal-700">{rptSummary.total_irs || 0}</p>
                      <p className="text-[10px] text-teal-600 font-medium uppercase">Inward Receipts</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-emerald-700">{(rptSummary.total_fg_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-emerald-600 font-medium uppercase">FG Received (Kg)</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-orange-700">{(rptSummary.total_waste_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-orange-600 font-medium uppercase">Waste (Kg)</p>
                    </div>
                    <div className="bg-rose-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-rose-700">{(rptSummary.total_rejection_kgs || 0).toLocaleString()}</p>
                      <p className="text-[10px] text-rose-600 font-medium uppercase">Rejection (Kg)</p>
                    </div>
                  </div>
                  {rptSummary.total_dispatched_kgs > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Dispatched vs Accounted</span>
                        <span>{((rptSummary.total_dispatched_kgs - rptSummary.unaccounted_kgs) / rptSummary.total_dispatched_kgs * 100).toFixed(1)}% accounted</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden flex">
                        <div className="bg-emerald-500 h-3" style={{ width: `${(rptSummary.total_fg_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`FG: ${rptSummary.total_fg_kgs} kg`} />
                        <div className="bg-orange-400 h-3" style={{ width: `${(rptSummary.total_waste_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`Waste: ${rptSummary.total_waste_kgs} kg`} />
                        <div className="bg-rose-400 h-3" style={{ width: `${(rptSummary.total_rejection_kgs / rptSummary.total_dispatched_kgs * 100)}%` }} title={`Rejection: ${rptSummary.total_rejection_kgs} kg`} />
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />FG</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400" />Waste</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Rejection</span>
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-200" />Unaccounted</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="h-16 w-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
                    <BarChart3 className="h-7 w-7 text-indigo-300" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Loading Reports...</h3>
                  <p className="text-xs text-gray-500">Data will appear once loaded.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══ View Inward Receipt Dialog ═══ */}
      <Dialog open={viewIROpen} onOpenChange={setViewIROpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-teal-600" />
              Inward Receipt Details
            </DialogTitle>
          </DialogHeader>

          {viewIRLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : viewIRData ? (
            <div className="space-y-4">
              {/* Receipt Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-gray-50 rounded-lg p-3">
                <div><span className="text-gray-500">IR Number:</span> <span className="font-semibold">{viewIRData.receipt.ir_number}</span></div>
                <div><span className="text-gray-500">Challan No:</span> <span className="font-semibold">{viewIRData.receipt.challan_no || "-"}</span></div>
                <div><span className="text-gray-500">JWO Challan:</span> <span className="font-mono font-semibold">{viewIRData.receipt.jwo_challan}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-semibold">{viewIRData.receipt.receipt_date}</span></div>
                <div><span className="text-gray-500">Type:</span>{' '}
                  <Badge variant="outline" className={`text-[9px] font-semibold ${viewIRData.receipt.receipt_type === 'final' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                    {viewIRData.receipt.receipt_type === 'final' ? 'Final' : 'Partial'}
                  </Badge>
                </div>
                <div><span className="text-gray-500">Party:</span> <span className="font-semibold">{viewIRData.receipt.to_party || "-"}</span></div>
                {viewIRData.receipt.process_type && (
                  <div><span className="text-gray-500">Process:</span> <span className="font-semibold">{viewIRData.receipt.process_type}</span></div>
                )}
                {viewIRData.receipt.vehicle_no && (
                  <div><span className="text-gray-500">Vehicle:</span> <span className="font-semibold">{viewIRData.receipt.vehicle_no}</span></div>
                )}
                {viewIRData.receipt.driver_name && (
                  <div><span className="text-gray-500">Driver:</span> <span className="font-semibold">{viewIRData.receipt.driver_name}</span></div>
                )}
                {viewIRData.receipt.remarks && (
                  <div className="col-span-2 sm:col-span-3"><span className="text-gray-500">Remarks:</span> <span>{viewIRData.receipt.remarks}</span></div>
                )}
              </div>

              {/* Line Items Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Item Description</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-600">Sent (Kg)</th>
                      <th className="px-3 py-2 text-right font-medium text-emerald-700 bg-emerald-50">FG (Kg)</th>
                      <th className="px-3 py-2 text-right font-medium text-orange-700 bg-orange-50">Waste (Kg)</th>
                      <th className="px-3 py-2 text-right font-medium text-rose-700 bg-rose-50">Rejection (Kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewIRData.lines.map((line: any, idx: number) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="px-3 py-2 text-gray-500">{line.sl_no}</td>
                        <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={line.item_description}>{line.item_description}</td>
                        <td className="px-3 py-2 text-right font-medium">{line.sent_kgs.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">{line.finished_goods_kgs.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium text-orange-700">{line.waste_kgs.toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-medium text-rose-700">{line.rejection_kgs.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100 border-t font-semibold">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right">{viewIRData.lines.reduce((s: number, l: any) => s + l.sent_kgs, 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{viewIRData.lines.reduce((s: number, l: any) => s + l.finished_goods_kgs, 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-orange-700">{viewIRData.lines.reduce((s: number, l: any) => s + l.waste_kgs, 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-rose-700">{viewIRData.lines.reduce((s: number, l: any) => s + l.rejection_kgs, 0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="text-[10px] text-gray-400 text-right">
                Created by {viewIRData.receipt.created_by || "—"} on {viewIRData.receipt.created_at}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
