"use client"

import React, { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import type { Company } from "@/types/auth"
import type {
  JobworkDetailRow,
  JobworkSummaryRow,
  InwardReceipt,
  GroupByOption,
} from "@/types/jobwork"
import {
  Copy, Download, Send, Loader2, ChevronDown,
  ChevronRight, X, Filter, ArrowLeft, Package,
  TrendingUp, AlertTriangle, Clock, CheckCircle, BarChart3,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════
// MOCK FLAT DATA — every JWO as a row, all filtering is client-side
// ═══════════════════════════════════════════════════════════════

const ALL_JWOS: JobworkDetailRow[] = [
  { id: 1, jwo_id: "JWO-2026-001", dispatch_date: "2026-01-10", vendor_name: "Raju Cracking Works", item_name: "Almond Inshell", process_type: "Cracking", qty_dispatched: 5000, fg_received: 3600, waste_received: 700, rejection: 100, unaccounted_balance: 600, actual_loss_pct: 12.0, loss_status: "Excess Loss", jwo_status: "Fully Received", turnaround_days: 14 },
  { id: 2, jwo_id: "JWO-2026-004", dispatch_date: "2026-01-22", vendor_name: "Raju Cracking Works", item_name: "Walnut Inshell", process_type: "Cracking", qty_dispatched: 3200, fg_received: 2350, waste_received: 450, rejection: 80, unaccounted_balance: 320, actual_loss_pct: 7.5, loss_status: "Normal", jwo_status: "Reconciled", turnaround_days: 20 },
  { id: 3, jwo_id: "JWO-2026-007", dispatch_date: "2026-02-05", vendor_name: "Raju Cracking Works", item_name: "Pistachio Inshell", process_type: "Cracking", qty_dispatched: 4500, fg_received: 3200, waste_received: 600, rejection: 90, unaccounted_balance: 610, actual_loss_pct: 9.1, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 16 },
  { id: 4, jwo_id: "JWO-2026-011", dispatch_date: "2026-02-18", vendor_name: "Raju Cracking Works", item_name: "Almond Inshell", process_type: "Cracking", qty_dispatched: 2800, fg_received: 2050, waste_received: 380, rejection: 50, unaccounted_balance: 320, actual_loss_pct: 8.6, loss_status: "Normal", jwo_status: "Fully Received", turnaround_days: 19 },
  { id: 5, jwo_id: "JWO-2026-015", dispatch_date: "2026-03-01", vendor_name: "Raju Cracking Works", item_name: "Walnut Inshell", process_type: "Cracking", qty_dispatched: 3500, fg_received: 2400, waste_received: 520, rejection: 80, unaccounted_balance: 500, actual_loss_pct: 10.3, loss_status: "Underweight Waste", jwo_status: "Partially Received", turnaround_days: null },
  { id: 6, jwo_id: "JWO-2026-018", dispatch_date: "2026-03-10", vendor_name: "Raju Cracking Works", item_name: "Pistachio Inshell", process_type: "Cracking", qty_dispatched: 2500, fg_received: 0, waste_received: 0, rejection: 0, unaccounted_balance: 2500, actual_loss_pct: 0, loss_status: "Pending", jwo_status: "Open", turnaround_days: null },
  { id: 7, jwo_id: "JWO-2026-020", dispatch_date: "2026-02-10", vendor_name: "Raju Cracking Works", item_name: "Almond Inshell", process_type: "Cracking", qty_dispatched: 2200, fg_received: 1600, waste_received: 300, rejection: 40, unaccounted_balance: 260, actual_loss_pct: 8.2, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 21 },
  { id: 8, jwo_id: "JWO-2026-022", dispatch_date: "2026-01-15", vendor_name: "Raju Cracking Works", item_name: "Cashew Whole", process_type: "Cracking", qty_dispatched: 1800, fg_received: 1300, waste_received: 250, rejection: 50, unaccounted_balance: 200, actual_loss_pct: 7.8, loss_status: "Normal", jwo_status: "Reconciled", turnaround_days: 17 },
  { id: 9, jwo_id: "JWO-2026-025", dispatch_date: "2026-02-22", vendor_name: "Raju Cracking Works", item_name: "Pistachio Inshell", process_type: "Cracking", qty_dispatched: 2000, fg_received: 1500, waste_received: 280, rejection: 30, unaccounted_balance: 190, actual_loss_pct: 6.5, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 13 },
  { id: 10, jwo_id: "JWO-2026-028", dispatch_date: "2026-03-05", vendor_name: "Raju Cracking Works", item_name: "Walnut Inshell", process_type: "Cracking", qty_dispatched: 1500, fg_received: 1000, waste_received: 220, rejection: 30, unaccounted_balance: 250, actual_loss_pct: 11.7, loss_status: "Excess Loss", jwo_status: "Fully Received", turnaround_days: 18 },
  { id: 11, jwo_id: "JWO-2026-030", dispatch_date: "2026-03-12", vendor_name: "Raju Cracking Works", item_name: "Almond Inshell", process_type: "Cracking", qty_dispatched: 1800, fg_received: 1200, waste_received: 250, rejection: 0, unaccounted_balance: 350, actual_loss_pct: 0, loss_status: "Pending", jwo_status: "Open", turnaround_days: null },
  { id: 12, jwo_id: "JWO-2026-032", dispatch_date: "2026-03-18", vendor_name: "Raju Cracking Works", item_name: "Cashew Whole", process_type: "Cracking", qty_dispatched: 1700, fg_received: 1200, waste_received: 250, rejection: 0, unaccounted_balance: 250, actual_loss_pct: 0, loss_status: "Pending", jwo_status: "Partially Received", turnaround_days: null },
  { id: 13, jwo_id: "JWO-2026-002", dispatch_date: "2026-01-12", vendor_name: "Sharma Processors", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 4000, fg_received: 2800, waste_received: 600, rejection: 80, unaccounted_balance: 520, actual_loss_pct: 13.0, loss_status: "Excess Loss", jwo_status: "Reconciled", turnaround_days: 25 },
  { id: 14, jwo_id: "JWO-2026-005", dispatch_date: "2026-01-28", vendor_name: "Sharma Processors", item_name: "Dried Figs", process_type: "Slicing", qty_dispatched: 2500, fg_received: 1900, waste_received: 300, rejection: 40, unaccounted_balance: 260, actual_loss_pct: 7.2, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 18 },
  { id: 15, jwo_id: "JWO-2026-009", dispatch_date: "2026-02-08", vendor_name: "Sharma Processors", item_name: "Apricot Whole", process_type: "Dicing", qty_dispatched: 3000, fg_received: 2100, waste_received: 400, rejection: 70, unaccounted_balance: 430, actual_loss_pct: 10.7, loss_status: "Excess Loss", jwo_status: "Fully Received", turnaround_days: 22 },
  { id: 16, jwo_id: "JWO-2026-013", dispatch_date: "2026-02-20", vendor_name: "Sharma Processors", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 3500, fg_received: 2600, waste_received: 480, rejection: 60, unaccounted_balance: 360, actual_loss_pct: 7.3, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 20 },
  { id: 17, jwo_id: "JWO-2026-016", dispatch_date: "2026-03-02", vendor_name: "Sharma Processors", item_name: "Raisins Golden", process_type: "Stuffing", qty_dispatched: 2000, fg_received: 1500, waste_received: 280, rejection: 30, unaccounted_balance: 190, actual_loss_pct: 6.5, loss_status: "Normal", jwo_status: "Fully Received", turnaround_days: 19 },
  { id: 18, jwo_id: "JWO-2026-019", dispatch_date: "2026-03-08", vendor_name: "Sharma Processors", item_name: "Dried Figs", process_type: "Slicing", qty_dispatched: 2200, fg_received: 1600, waste_received: 280, rejection: 40, unaccounted_balance: 280, actual_loss_pct: 9.1, loss_status: "Normal", jwo_status: "Reconciled", turnaround_days: 16 },
  { id: 19, jwo_id: "JWO-2026-023", dispatch_date: "2026-03-14", vendor_name: "Sharma Processors", item_name: "Apricot Whole", process_type: "Dicing", qty_dispatched: 2500, fg_received: 1700, waste_received: 300, rejection: 50, unaccounted_balance: 450, actual_loss_pct: 12.0, loss_status: "Underweight Waste", jwo_status: "Partially Received", turnaround_days: null },
  { id: 20, jwo_id: "JWO-2026-026", dispatch_date: "2026-03-20", vendor_name: "Sharma Processors", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 2300, fg_received: 1600, waste_received: 160, rejection: 50, unaccounted_balance: 490, actual_loss_pct: 14.3, loss_status: "Excess Loss", jwo_status: "Fully Received", turnaround_days: 24 },
  { id: 21, jwo_id: "JWO-2026-003", dispatch_date: "2026-01-18", vendor_name: "Patel Deseeding Unit", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 3500, fg_received: 2700, waste_received: 450, rejection: 50, unaccounted_balance: 300, actual_loss_pct: 6.0, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 12 },
  { id: 22, jwo_id: "JWO-2026-008", dispatch_date: "2026-02-06", vendor_name: "Patel Deseeding Unit", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 3000, fg_received: 2200, waste_received: 400, rejection: 60, unaccounted_balance: 340, actual_loss_pct: 8.3, loss_status: "Normal", jwo_status: "Reconciled", turnaround_days: 16 },
  { id: 23, jwo_id: "JWO-2026-012", dispatch_date: "2026-02-19", vendor_name: "Patel Deseeding Unit", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 2800, fg_received: 2140, waste_received: 350, rejection: 40, unaccounted_balance: 270, actual_loss_pct: 6.8, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 14 },
  { id: 24, jwo_id: "JWO-2026-017", dispatch_date: "2026-03-04", vendor_name: "Patel Deseeding Unit", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 2500, fg_received: 1800, waste_received: 350, rejection: 30, unaccounted_balance: 320, actual_loss_pct: 8.8, loss_status: "Normal", jwo_status: "Fully Received", turnaround_days: 17 },
  { id: 25, jwo_id: "JWO-2026-024", dispatch_date: "2026-03-15", vendor_name: "Patel Deseeding Unit", item_name: "Dates (with seed)", process_type: "Deseeding", qty_dispatched: 2200, fg_received: 1700, waste_received: 250, rejection: 30, unaccounted_balance: 220, actual_loss_pct: 7.0, loss_status: "Pending", jwo_status: "Open", turnaround_days: null },
  { id: 26, jwo_id: "JWO-2026-006", dispatch_date: "2026-02-01", vendor_name: "Gujarat Dry Fruits Processing", item_name: "Cashew Whole", process_type: "Thermopacking", qty_dispatched: 3000, fg_received: 2200, waste_received: 400, rejection: 60, unaccounted_balance: 340, actual_loss_pct: 7.6, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 10 },
  { id: 27, jwo_id: "JWO-2026-014", dispatch_date: "2026-02-21", vendor_name: "Gujarat Dry Fruits Processing", item_name: "Raisins Golden", process_type: "Thermopacking", qty_dispatched: 2800, fg_received: 2100, waste_received: 380, rejection: 60, unaccounted_balance: 260, actual_loss_pct: 6.3, loss_status: "Normal", jwo_status: "Reconciled", turnaround_days: 11 },
  { id: 28, jwo_id: "JWO-2026-021", dispatch_date: "2026-03-06", vendor_name: "Gujarat Dry Fruits Processing", item_name: "Almond Inshell", process_type: "Thermopacking", qty_dispatched: 2700, fg_received: 1900, waste_received: 320, rejection: 60, unaccounted_balance: 420, actual_loss_pct: 6.5, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 14 },
  { id: 29, jwo_id: "JWO-2026-010", dispatch_date: "2026-02-12", vendor_name: "Mehta Thermopacking", item_name: "Pistachio Inshell", process_type: "Thermopacking", qty_dispatched: 2500, fg_received: 1800, waste_received: 340, rejection: 45, unaccounted_balance: 315, actual_loss_pct: 8.4, loss_status: "Normal", jwo_status: "Open", turnaround_days: null },
  { id: 30, jwo_id: "JWO-2026-027", dispatch_date: "2026-03-16", vendor_name: "Mehta Thermopacking", item_name: "Cashew Whole", process_type: "Thermopacking", qty_dispatched: 2000, fg_received: 1400, waste_received: 260, rejection: 40, unaccounted_balance: 300, actual_loss_pct: 10.0, loss_status: "Underweight Waste", jwo_status: "Partially Received", turnaround_days: null },
  { id: 31, jwo_id: "JWO-2026-029", dispatch_date: "2026-01-25", vendor_name: "Singh Slicing Co.", item_name: "Dried Figs", process_type: "Slicing", qty_dispatched: 1800, fg_received: 1000, waste_received: 280, rejection: 40, unaccounted_balance: 480, actual_loss_pct: 17.8, loss_status: "Excess Loss", jwo_status: "Reconciled", turnaround_days: 22 },
  { id: 32, jwo_id: "JWO-2026-031", dispatch_date: "2026-02-15", vendor_name: "Singh Slicing Co.", item_name: "Apricot Whole", process_type: "Slicing", qty_dispatched: 1500, fg_received: 1100, waste_received: 200, rejection: 30, unaccounted_balance: 170, actual_loss_pct: 7.6, loss_status: "Normal", jwo_status: "Closed", turnaround_days: 18 },
  { id: 33, jwo_id: "JWO-2026-033", dispatch_date: "2026-03-01", vendor_name: "Singh Slicing Co.", item_name: "Dried Figs", process_type: "Slicing", qty_dispatched: 1200, fg_received: 800, waste_received: 200, rejection: 30, unaccounted_balance: 170, actual_loss_pct: 9.4, loss_status: "Normal", jwo_status: "Fully Received", turnaround_days: 20 },
  { id: 34, jwo_id: "JWO-2026-034", dispatch_date: "2026-03-19", vendor_name: "Singh Slicing Co.", item_name: "Apricot Whole", process_type: "Dicing", qty_dispatched: 1500, fg_received: 300, waste_received: 240, rejection: 40, unaccounted_balance: 920, actual_loss_pct: 0, loss_status: "Pending", jwo_status: "Open", turnaround_days: null },
]

const MOCK_JWO_RECEIPTS: Record<number, InwardReceipt[]> = {
  1: [
    { id: 101, jwo_id: 1, ir_number: "IR-2026-001", ir_date: "2026-01-16", receipt_type: "Partial", fg_qty_received: 2000, waste_qty_received: 350, rejection_qty: 50, actual_loss_pct: 4.0, loss_status: "Normal", remarks: "First batch - good quality", created_at: "2026-01-16" },
    { id: 102, jwo_id: 1, ir_number: "IR-2026-004", ir_date: "2026-01-22", receipt_type: "Partial", fg_qty_received: 1000, waste_qty_received: 200, rejection_qty: 30, actual_loss_pct: 8.4, loss_status: "Normal", remarks: "Second batch received", created_at: "2026-01-22" },
    { id: 103, jwo_id: 1, ir_number: "IR-2026-008", ir_date: "2026-01-24", receipt_type: "Final", fg_qty_received: 600, waste_qty_received: 150, rejection_qty: 20, actual_loss_pct: 12.0, loss_status: "Excess Loss", remarks: "Final batch - excess loss noted", created_at: "2026-01-24" },
  ],
  2: [
    { id: 104, jwo_id: 2, ir_number: "IR-2026-006", ir_date: "2026-02-02", receipt_type: "Partial", fg_qty_received: 1500, waste_qty_received: 250, rejection_qty: 40, actual_loss_pct: 5.6, loss_status: "Normal", remarks: "Good condition", created_at: "2026-02-02" },
    { id: 105, jwo_id: 2, ir_number: "IR-2026-012", ir_date: "2026-02-11", receipt_type: "Final", fg_qty_received: 850, waste_qty_received: 200, rejection_qty: 40, actual_loss_pct: 7.5, loss_status: "Normal", remarks: "Completed", created_at: "2026-02-11" },
  ],
  5: [
    { id: 106, jwo_id: 5, ir_number: "IR-2026-020", ir_date: "2026-03-10", receipt_type: "Partial", fg_qty_received: 1500, waste_qty_received: 320, rejection_qty: 50, actual_loss_pct: 6.6, loss_status: "Normal", remarks: "First lot received", created_at: "2026-03-10" },
    { id: 107, jwo_id: 5, ir_number: "IR-2026-025", ir_date: "2026-03-18", receipt_type: "Partial", fg_qty_received: 900, waste_qty_received: 200, rejection_qty: 30, actual_loss_pct: 10.3, loss_status: "Underweight Waste", remarks: "Underweight detected", created_at: "2026-03-18" },
  ],
  13: [
    { id: 108, jwo_id: 13, ir_number: "IR-2026-002", ir_date: "2026-01-20", receipt_type: "Partial", fg_qty_received: 1500, waste_qty_received: 300, rejection_qty: 40, actual_loss_pct: 4.0, loss_status: "Normal", remarks: "Deseeded dates - clean batch", created_at: "2026-01-20" },
    { id: 109, jwo_id: 13, ir_number: "IR-2026-007", ir_date: "2026-01-30", receipt_type: "Partial", fg_qty_received: 800, waste_qty_received: 180, rejection_qty: 20, actual_loss_pct: 9.0, loss_status: "Normal", remarks: "Second delivery", created_at: "2026-01-30" },
    { id: 110, jwo_id: 13, ir_number: "IR-2026-011", ir_date: "2026-02-06", receipt_type: "Final", fg_qty_received: 500, waste_qty_received: 120, rejection_qty: 20, actual_loss_pct: 13.0, loss_status: "Excess Loss", remarks: "High loss in final batch", created_at: "2026-02-06" },
  ],
  21: [
    { id: 111, jwo_id: 21, ir_number: "IR-2026-003", ir_date: "2026-01-24", receipt_type: "Partial", fg_qty_received: 1800, waste_qty_received: 250, rejection_qty: 25, actual_loss_pct: 3.6, loss_status: "Normal", remarks: "Excellent quality", created_at: "2026-01-24" },
    { id: 112, jwo_id: 21, ir_number: "IR-2026-009", ir_date: "2026-01-30", receipt_type: "Final", fg_qty_received: 900, waste_qty_received: 200, rejection_qty: 25, actual_loss_pct: 6.0, loss_status: "Normal", remarks: "Within expected loss", created_at: "2026-01-30" },
  ],
  31: [
    { id: 113, jwo_id: 31, ir_number: "IR-2026-015", ir_date: "2026-02-06", receipt_type: "Partial", fg_qty_received: 600, waste_qty_received: 150, rejection_qty: 20, actual_loss_pct: 5.6, loss_status: "Normal", remarks: "Sliced figs - first batch", created_at: "2026-02-06" },
    { id: 114, jwo_id: 31, ir_number: "IR-2026-019", ir_date: "2026-02-16", receipt_type: "Final", fg_qty_received: 400, waste_qty_received: 130, rejection_qty: 20, actual_loss_pct: 17.8, loss_status: "Excess Loss", remarks: "Very high loss - vendor claims spoilage", created_at: "2026-02-16" },
  ],
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const LOSS_COLORS: Record<string, string> = {
  Normal: "bg-green-100 text-green-800 border-green-300",
  "Excess Loss": "bg-red-100 text-red-800 border-red-300",
  "Underweight Waste": "bg-amber-100 text-amber-800 border-amber-300",
  Pending: "bg-gray-100 text-gray-600 border-gray-300",
}
const STATUS_COLORS: Record<string, string> = {
  Open: "bg-blue-100 text-blue-800 border-blue-300",
  "Partially Received": "bg-orange-100 text-orange-800 border-orange-300",
  "Fully Received": "bg-teal-100 text-teal-800 border-teal-300",
  Reconciled: "bg-purple-100 text-purple-800 border-purple-300",
  Closed: "bg-green-100 text-green-800 border-green-300",
}

const GROUP_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "item", label: "Item" },
  { value: "process_type", label: "Process" },
  { value: "month", label: "Month" },
  { value: "jwo_status", label: "Status" },
]

function fmtKgs(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }) }
function getMonth(d: string) { return d.substring(0, 7) } // "2026-01"
function monthLabel(m: string) {
  const [y, mo] = m.split("-")
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  return `${months[parseInt(mo) - 1]} ${y}`
}

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════

interface Props { params: { company: Company } }

export default function JobworkDashboardPage({ params }: Props) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()

  // Filter state
  const [selVendors, setSelVendors] = useState<Set<string>>(new Set())
  const [selItems, setSelItems] = useState<Set<string>>(new Set())
  const [selProcess, setSelProcess] = useState<Set<string>>(new Set())
  const [selStatus, setSelStatus] = useState<Set<string>>(new Set())
  const [selLoss, setSelLoss] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [groupBy, setGroupBy] = useState<GroupByOption>("vendor")

  // Expansion state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedJWOs, setExpandedJWOs] = useState<Set<number>>(new Set())
  const [jwoReceipts, setJwoReceipts] = useState<Record<number, InwardReceipt[]>>({})
  const [loadingJWOs, setLoadingJWOs] = useState<Set<number>>(new Set())

  // ── Filtered data (instant, no page reload) ──
  const filtered = useMemo(() => {
    return ALL_JWOS.filter(j => {
      if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
      if (selItems.size > 0 && !selItems.has(j.item_name)) return false
      if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
      if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
      if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
      if (dateFrom && j.dispatch_date < dateFrom) return false
      if (dateTo && j.dispatch_date > dateTo) return false
      return true
    })
  }, [selVendors, selItems, selProcess, selStatus, selLoss, dateFrom, dateTo])

  // ── Cascading: available options based on current filtered data ──
  const availableVendors = useMemo(() => [...new Set(ALL_JWOS.filter(j => {
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.vendor_name))].sort(), [selItems, selProcess, selStatus, selLoss, dateFrom, dateTo])

  const availableItems = useMemo(() => [...new Set(ALL_JWOS.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.item_name))].sort(), [selVendors, selProcess, selStatus, selLoss, dateFrom, dateTo])

  const availableProcess = useMemo(() => [...new Set(ALL_JWOS.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.process_type))].sort(), [selVendors, selItems, selStatus, selLoss, dateFrom, dateTo])

  const availableStatuses = useMemo(() => [...new Set(ALL_JWOS.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selLoss.size > 0 && !selLoss.has(j.loss_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.jwo_status))], [selVendors, selItems, selProcess, selLoss, dateFrom, dateTo])

  const availableLoss = useMemo(() => [...new Set(ALL_JWOS.filter(j => {
    if (selVendors.size > 0 && !selVendors.has(j.vendor_name)) return false
    if (selItems.size > 0 && !selItems.has(j.item_name)) return false
    if (selProcess.size > 0 && !selProcess.has(j.process_type)) return false
    if (selStatus.size > 0 && !selStatus.has(j.jwo_status)) return false
    if (dateFrom && j.dispatch_date < dateFrom) return false
    if (dateTo && j.dispatch_date > dateTo) return false
    return true
  }).map(j => j.loss_status))], [selVendors, selItems, selProcess, selStatus, dateFrom, dateTo])

  // ── KPIs from filtered data ──
  const kpis = useMemo(() => {
    const total = filtered.length
    const dispatched = filtered.reduce((s, j) => s + j.qty_dispatched, 0)
    const fg = filtered.reduce((s, j) => s + j.fg_received, 0)
    const losses = filtered.filter(j => j.actual_loss_pct > 0).map(j => j.actual_loss_pct)
    const avgLoss = losses.length ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0
    const openPending = filtered.filter(j => j.jwo_status === "Open" || j.jwo_status === "Partially Received").length
    const excessFlags = filtered.filter(j => j.loss_status === "Excess Loss").length
    return { total, dispatched, fg, avgLoss, openPending, excessFlags }
  }, [filtered])

  // ── Grouped summary from filtered data ──
  const grouped = useMemo(() => {
    const map = new Map<string, JobworkDetailRow[]>()
    for (const j of filtered) {
      let key: string
      if (groupBy === "vendor") key = j.vendor_name
      else if (groupBy === "item") key = j.item_name
      else if (groupBy === "process_type") key = j.process_type
      else if (groupBy === "month") key = getMonth(j.dispatch_date)
      else key = j.jwo_status
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(j)
    }

    const rows: (JobworkSummaryRow & { _jwos: JobworkDetailRow[] })[] = []
    for (const [label, jwos] of map) {
      const dispatched = jwos.reduce((s, j) => s + j.qty_dispatched, 0)
      const fg = jwos.reduce((s, j) => s + j.fg_received, 0)
      const waste = jwos.reduce((s, j) => s + j.waste_received, 0)
      const rej = jwos.reduce((s, j) => s + j.rejection, 0)
      const unaccounted = dispatched - fg - waste - rej
      const losses = jwos.filter(j => j.actual_loss_pct > 0).map(j => j.actual_loss_pct)
      const avgLoss = losses.length ? +(losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(1) : 0
      const open = jwos.filter(j => j.jwo_status === "Open" || j.jwo_status === "Partially Received").length
      const overdue = jwos.filter(j => {
        if (j.jwo_status !== "Open" && j.jwo_status !== "Partially Received") return false
        const days = (Date.now() - new Date(j.dispatch_date).getTime()) / 86400000
        return days > 30
      }).length
      const excessFlags = jwos.filter(j => j.loss_status === "Excess Loss").length
      const tatJwos = jwos.filter(j => j.turnaround_days !== null)
      const avgTat = tatJwos.length ? Math.round(tatJwos.reduce((s, j) => s + (j.turnaround_days || 0), 0) / tatJwos.length) : 0

      rows.push({
        group_label: groupBy === "month" ? monthLabel(label) : label,
        num_jwos: jwos.length,
        total_dispatched_kgs: dispatched,
        total_fg_received_kgs: fg,
        total_waste_received_kgs: waste,
        total_rejection_kgs: rej,
        unaccounted_balance_kgs: unaccounted,
        avg_loss_pct: avgLoss,
        open_jwos: open,
        overdue_jwos: overdue,
        excess_loss_flags: excessFlags,
        avg_turnaround_days: avgTat,
        _jwos: jwos,
      })
    }
    rows.sort((a, b) => b.total_dispatched_kgs - a.total_dispatched_kgs)
    return rows
  }, [filtered, groupBy])

  // ── Filter count ──
  const filterCount = [selVendors.size, selItems.size, selProcess.size, selStatus.size, selLoss.size, dateFrom ? 1 : 0, dateTo ? 1 : 0].filter(v => v > 0).length

  // ── Toggle helpers (no page reload) ──
  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    next.has(val) ? next.delete(val) : next.add(val)
    setter(next)
  }

  const clearAll = () => {
    setSelVendors(new Set()); setSelItems(new Set()); setSelProcess(new Set())
    setSelStatus(new Set()); setSelLoss(new Set()); setDateFrom(""); setDateTo("")
  }

  const toggleGroupRow = (label: string) => {
    const next = new Set(expandedGroups)
    next.has(label) ? next.delete(label) : next.add(label)
    setExpandedGroups(next)
  }

  const toggleJWO = async (id: number) => {
    const next = new Set(expandedJWOs)
    if (next.has(id)) { next.delete(id); setExpandedJWOs(next); return }
    next.add(id)
    setExpandedJWOs(next)
    if (!jwoReceipts[id]) {
      setLoadingJWOs(prev => new Set(prev).add(id))
      await new Promise(r => setTimeout(r, 200))
      setJwoReceipts(prev => ({ ...prev, [id]: MOCK_JWO_RECEIPTS[id] || [] }))
      setLoadingJWOs(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ── Copy ──
  const handleCopy = () => {
    let text = `Jobwork Summary — ${company.toUpperCase()} — ${new Date().toISOString().split("T")[0]}\n\n`
    text += `Total JWOs       : ${kpis.total}\nTotal Dispatched : ${fmtKgs(kpis.dispatched)} Kgs\n`
    text += `Total FG Recvd   : ${fmtKgs(kpis.fg)} Kgs\nAvg Loss %       : ${kpis.avgLoss}%\n`
    text += `Open JWOs        : ${kpis.openPending}\nExcess Loss Flags: ${kpis.excessFlags}\n\n`
    for (const r of grouped) {
      text += `${r.group_label.padEnd(30)} ${String(r.num_jwos).padStart(3)} JWOs  ${fmtKgs(r.total_dispatched_kgs).padStart(10)} Kgs  ${r.avg_loss_pct}% loss\n`
    }
    navigator.clipboard.writeText(text)
    toast({ title: "Copied to clipboard!" })
  }

  // ── Chip component ──
  const Chip = ({ label, active, available, onClick }: { label: string; active: boolean; available: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      disabled={!available && !active}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
        ${active
          ? "bg-gray-900 text-white border-gray-900"
          : available
            ? "bg-white text-gray-700 border-gray-300 hover:border-gray-500 hover:bg-gray-50"
            : "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed"
        }`}
    >
      {label}
      {active && <span className="ml-1">×</span>}
    </button>
  )

  // ── Status chip (colored) ──
  const StatusChip = ({ label, colorMap }: { label: string; colorMap: Record<string, string> }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${colorMap[label] || "bg-gray-100 text-gray-600 border-gray-300"}`}>
      {label}
    </span>
  )

  return (
    <div className="space-y-5 p-4 md:p-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-600" />
              Jobwork Summary
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {company.toUpperCase()} &middot; As of {new Date().toISOString().split("T")[0]} &middot; {filtered.length} of {ALL_JWOS.length} JWOs
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}><Copy className="h-3.5 w-3.5 mr-1.5" />Copy</Button>
          <Button variant="outline" size="sm" disabled><Download className="h-3.5 w-3.5 mr-1.5" />Excel</Button>
          <Button variant="outline" size="sm" disabled title="Coming Soon"><Send className="h-3.5 w-3.5 mr-1.5" />WhatsApp</Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card>
        <CardContent className="pt-5 pb-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-semibold">Filters</span>
              {filterCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5">{filterCount} active</Badge>
              )}
            </div>
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600 hover:text-red-700" onClick={clearAll}>
                <X className="h-3 w-3 mr-1" />Clear all
              </Button>
            )}
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Date Range</label>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-xs" />
              <span className="text-xs text-gray-400">to</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-xs" />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500" onClick={() => { setDateFrom(""); setDateTo("") }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Vendor */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Vendor
              {selVendors.size > 0 && <span className="ml-1 text-gray-900">({selVendors.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(ALL_JWOS.map(j => j.vendor_name))].sort().map(v => (
                <Chip key={v} label={v} active={selVendors.has(v)} available={availableVendors.includes(v)} onClick={() => toggle(selVendors, v, setSelVendors)} />
              ))}
            </div>
          </div>

          {/* Item */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Item / Article
              {selItems.size > 0 && <span className="ml-1 text-gray-900">({selItems.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(ALL_JWOS.map(j => j.item_name))].sort().map(v => (
                <Chip key={v} label={v} active={selItems.has(v)} available={availableItems.includes(v)} onClick={() => toggle(selItems, v, setSelItems)} />
              ))}
            </div>
          </div>

          {/* Process Type */}
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Process Type
              {selProcess.size > 0 && <span className="ml-1 text-gray-900">({selProcess.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {["Deseeding","Cracking","Slicing","Dicing","Thermopacking","Stuffing"].map(v => (
                <Chip key={v} label={v} active={selProcess.has(v)} available={availableProcess.includes(v)} onClick={() => toggle(selProcess, v, setSelProcess)} />
              ))}
            </div>
          </div>

          {/* Status + Loss in one row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                JWO Status
                {selStatus.size > 0 && <span className="ml-1 text-gray-900">({selStatus.size})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Open","Partially Received","Fully Received","Reconciled","Closed"].map(v => (
                  <Chip key={v} label={v} active={selStatus.has(v)} available={availableStatuses.includes(v)} onClick={() => toggle(selStatus, v, setSelStatus)} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
                Loss Status
                {selLoss.size > 0 && <span className="ml-1 text-gray-900">({selLoss.size})</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {["Normal","Excess Loss","Underweight Waste","Pending"].map(v => (
                  <Chip key={v} label={v} active={selLoss.has(v)} available={availableLoss.includes(v)} onClick={() => toggle(selLoss, v, setSelLoss)} />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><Package className="h-4 w-4 text-blue-600" /><span className="text-[11px] font-medium text-gray-500">Total JWOs</span></div>
          <p className="text-2xl font-bold">{kpis.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-indigo-600" /><span className="text-[11px] font-medium text-gray-500">Dispatched</span></div>
          <p className="text-2xl font-bold">{fmtKgs(kpis.dispatched)}<span className="text-sm font-normal text-gray-500 ml-1">Kgs</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><CheckCircle className="h-4 w-4 text-green-600" /><span className="text-[11px] font-medium text-gray-500">FG Received</span></div>
          <p className="text-2xl font-bold">{fmtKgs(kpis.fg)}<span className="text-sm font-normal text-gray-500 ml-1">Kgs</span></p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-violet-600" /><span className="text-[11px] font-medium text-gray-500">Avg Loss</span></div>
          <p className="text-2xl font-bold">{kpis.avgLoss}<span className="text-sm font-normal text-gray-500 ml-0.5">%</span></p>
        </CardContent></Card>
        <Card className={kpis.openPending > 0 ? "border-amber-400 bg-amber-50/50" : ""}><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-4 w-4 text-amber-600" /><span className="text-[11px] font-medium text-gray-500">Open / Pending</span></div>
          <p className="text-2xl font-bold">{kpis.openPending}</p>
        </CardContent></Card>
        <Card className={kpis.excessFlags > 0 ? "border-red-400 bg-red-50/50" : ""}><CardContent className="pt-4 pb-3 px-4">
          <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-4 w-4 text-red-600" /><span className="text-[11px] font-medium text-gray-500">Excess Loss</span></div>
          <p className="text-2xl font-bold">{kpis.excessFlags}</p>
        </CardContent></Card>
      </div>

      {/* ── Group By Toggle ── */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Group by:</span>
        {GROUP_OPTIONS.map(o => (
          <button
            key={o.value}
            onClick={() => { setGroupBy(o.value); setExpandedGroups(new Set()); setExpandedJWOs(new Set()) }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all
              ${groupBy === o.value ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* ── Summary Table ── */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-10 w-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-500">No records match your filters</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={clearAll}>Clear all filters</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80">
                  <th className="w-8 p-3"></th>
                  <th className="text-left p-3 font-medium text-gray-600 min-w-[160px]">
                    {groupBy === "month" ? "Month" : groupBy === "vendor" ? "Vendor" : groupBy === "item" ? "Item" : groupBy === "process_type" ? "Process" : "Status"}
                  </th>
                  <th className="text-right p-3 font-medium text-gray-600">JWOs</th>
                  <th className="text-right p-3 font-medium text-gray-600">Dispatched</th>
                  <th className="text-right p-3 font-medium text-gray-600">FG Recvd</th>
                  <th className="text-right p-3 font-medium text-gray-600">Waste</th>
                  <th className="text-right p-3 font-medium text-gray-600">Rejection</th>
                  <th className="text-right p-3 font-medium text-gray-600">Unaccounted</th>
                  <th className="text-right p-3 font-medium text-gray-600">Loss %</th>
                  <th className="text-right p-3 font-medium text-gray-600">Open</th>
                  <th className="text-right p-3 font-medium text-gray-600">Overdue</th>
                  <th className="text-right p-3 font-medium text-gray-600">Excess</th>
                  <th className="text-right p-3 font-medium text-gray-600">TAT</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(row => {
                  const isOpen = expandedGroups.has(row.group_label)
                  return (
                    <GroupSection
                      key={row.group_label}
                      row={row}
                      jwos={row._jwos}
                      isOpen={isOpen}
                      onToggle={() => toggleGroupRow(row.group_label)}
                      expandedJWOs={expandedJWOs}
                      jwoReceipts={jwoReceipts}
                      loadingJWOs={loadingJWOs}
                      onToggleJWO={toggleJWO}
                      StatusChip={StatusChip}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// GROUP SECTION (summary row + expandable JWO rows)
// ═══════════════════════════════════════════════════════════════

function GroupSection({
  row, jwos, isOpen, onToggle, expandedJWOs, jwoReceipts, loadingJWOs, onToggleJWO, StatusChip,
}: {
  row: JobworkSummaryRow
  jwos: JobworkDetailRow[]
  isOpen: boolean
  onToggle: () => void
  expandedJWOs: Set<number>
  jwoReceipts: Record<number, InwardReceipt[]>
  loadingJWOs: Set<number>
  onToggleJWO: (id: number) => void
  StatusChip: any
}) {
  return (
    <>
      <tr className="border-b hover:bg-gray-50/60 cursor-pointer transition-colors" onClick={onToggle}>
        <td className="p-3">{isOpen ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}</td>
        <td className="p-3 font-medium">{row.group_label}</td>
        <td className="p-3 text-right font-medium">{row.num_jwos}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_dispatched_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_fg_received_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_waste_received_kgs)}</td>
        <td className="p-3 text-right">{fmtKgs(row.total_rejection_kgs)}</td>
        <td className={`p-3 text-right ${row.unaccounted_balance_kgs > 0 ? "text-amber-600 font-medium" : ""}`}>{fmtKgs(row.unaccounted_balance_kgs)}</td>
        <td className="p-3 text-right">{row.avg_loss_pct}%</td>
        <td className="p-3 text-right">{row.open_jwos || "-"}</td>
        <td className={`p-3 text-right ${row.overdue_jwos > 0 ? "text-red-600 font-bold" : ""}`}>{row.overdue_jwos || "-"}</td>
        <td className={`p-3 text-right ${row.excess_loss_flags > 0 ? "text-red-600 font-bold" : ""}`}>{row.excess_loss_flags || "-"}</td>
        <td className="p-3 text-right">{row.avg_turnaround_days || "-"}</td>
      </tr>

      {isOpen && jwos.sort((a, b) => b.dispatch_date < a.dispatch_date ? -1 : 1).map(jwo => {
        const isOverdue = (jwo.jwo_status === "Open" || jwo.jwo_status === "Partially Received") && (Date.now() - new Date(jwo.dispatch_date).getTime()) / 86400000 > 30
        const jwoOpen = expandedJWOs.has(jwo.id)
        const receipts = jwoReceipts[jwo.id] || []
        const isLoadingIR = loadingJWOs.has(jwo.id)

        return (
          <React.Fragment key={jwo.id}>
            <tr
              className={`border-b cursor-pointer transition-colors text-xs ${isOverdue ? "bg-red-50/60" : "bg-gray-50/30"} hover:bg-gray-100/60`}
              onClick={() => onToggleJWO(jwo.id)}
            >
              <td className="p-2.5 pl-8">
                {isLoadingIR ? <Loader2 className="h-3 w-3 animate-spin" /> : jwoOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3 text-gray-400" />}
              </td>
              <td className="p-2.5">
                <span className="font-mono font-medium text-gray-900">{jwo.jwo_id}</span>
                <span className="text-gray-400 ml-2">{jwo.dispatch_date}</span>
              </td>
              <td className="p-2.5 text-right" colSpan={1}>
                <div className="text-gray-700">{jwo.vendor_name}</div>
                <div className="text-gray-400">{jwo.item_name} &middot; {jwo.process_type}</div>
              </td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.qty_dispatched)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.fg_received)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.waste_received)}</td>
              <td className="p-2.5 text-right">{fmtKgs(jwo.rejection)}</td>
              <td className={`p-2.5 text-right ${jwo.unaccounted_balance > 0 ? "text-amber-600 font-medium bg-amber-50/50" : ""}`}>{fmtKgs(jwo.unaccounted_balance)}</td>
              <td className="p-2.5 text-right">{jwo.actual_loss_pct > 0 ? `${jwo.actual_loss_pct}%` : "-"}</td>
              <td className="p-2.5" colSpan={3}>
                <div className="flex gap-1 justify-end flex-wrap">
                  <StatusChip label={jwo.loss_status} colorMap={LOSS_COLORS} />
                  <StatusChip label={jwo.jwo_status} colorMap={STATUS_COLORS} />
                </div>
              </td>
              <td className="p-2.5 text-right">{jwo.turnaround_days ?? "-"}</td>
            </tr>

            {/* IR receipts */}
            {jwoOpen && receipts.length > 0 && (
              <tr><td colSpan={13} className="p-0">
                <div className="bg-white border-l-4 border-blue-200 ml-14 mr-4 my-1.5 rounded shadow-sm">
                  <table className="w-full text-[11px]">
                    <thead><tr className="border-b bg-blue-50/40">
                      <th className="text-left p-2 font-medium text-gray-500">IR No.</th>
                      <th className="text-left p-2 font-medium text-gray-500">Date</th>
                      <th className="text-left p-2 font-medium text-gray-500">Type</th>
                      <th className="text-right p-2 font-medium text-gray-500">FG Qty</th>
                      <th className="text-right p-2 font-medium text-gray-500">Waste</th>
                      <th className="text-right p-2 font-medium text-gray-500">Rejection</th>
                      <th className="text-right p-2 font-medium text-gray-500">Loss %</th>
                      <th className="text-left p-2 font-medium text-gray-500">Status</th>
                      <th className="text-left p-2 font-medium text-gray-500">Remarks</th>
                    </tr></thead>
                    <tbody>
                      {receipts.map(ir => (
                        <tr key={ir.id} className="border-b last:border-0 hover:bg-blue-50/20">
                          <td className="p-2 font-mono">{ir.ir_number}</td>
                          <td className="p-2">{ir.ir_date}</td>
                          <td className="p-2">
                            <Badge variant={ir.receipt_type === "Final" ? "default" : "outline"} className="text-[9px] h-4">{ir.receipt_type}</Badge>
                          </td>
                          <td className="p-2 text-right">{ir.fg_qty_received}</td>
                          <td className="p-2 text-right">{ir.waste_qty_received}</td>
                          <td className="p-2 text-right">{ir.rejection_qty}</td>
                          <td className="p-2 text-right">{ir.actual_loss_pct}%</td>
                          <td className="p-2"><StatusChip label={ir.loss_status} colorMap={LOSS_COLORS} /></td>
                          <td className="p-2 text-gray-400 max-w-[180px] truncate">{ir.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </td></tr>
            )}
            {jwoOpen && receipts.length === 0 && !isLoadingIR && (
              <tr><td colSpan={13} className="p-2.5 pl-14 text-[11px] text-gray-400">No inward receipts recorded</td></tr>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}

