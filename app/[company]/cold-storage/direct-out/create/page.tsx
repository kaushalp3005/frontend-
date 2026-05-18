"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  ArrowLeft, Search, X, Loader2, Trash2, Send, Package,
} from "lucide-react"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useToast } from "@/hooks/use-toast"
import { useAuthStore } from "@/lib/stores/auth"
import { getColdWarehouseCodes } from "@/lib/constants/warehouses"
import {
  ColdStorageApiService,
  type ColdStorageStockRecord,
} from "@/lib/api/coldStorageApiService"

interface DirectOutPageProps {
  params: { company: string }
}

interface DirectOutLine {
  rowId: string
  stockId: number
  itemDescription: string
  lotNo: string
  inwardNo: string
  itemMark: string
  availableQty: number
  availableWeightKg: number | null
  issueQty: number
  uom: string
  warehouse: string
  unit: string
  boxId: string | null
  transactionNo: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

// ── Cold Storage Stock Search (mirrors directtransferform/page.tsx) ──
function ColdStorageStockSearch({
  onSelect,
  company,
}: {
  onSelect: (record: ColdStorageStockRecord) => void
  company: string
}) {
  const [coldCompany, setColdCompany] = useState(company.toLowerCase())
  const [lotNoSearch, setLotNoSearch] = useState("")
  const [descSearch, setDescSearch] = useState("")
  const [results, setResults] = useState<ColdStorageStockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(
    async (lotNo: string, desc: string) => {
      if (!lotNo && !desc) {
        setResults([])
        setShowResults(false)
        return
      }
      setLoading(true)
      try {
        const params: Record<string, string> = { company: coldCompany }
        if (lotNo.trim()) params.lot_no = lotNo.trim()
        if (desc.trim()) params.q = desc.trim()
        const data = await ColdStorageApiService.searchColdStorageStocks(params)
        setResults(data.results)
        setShowResults(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [coldCompany],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(lotNoSearch, descSearch)
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [lotNoSearch, descSearch, doSearch])

  const handleSelect = (record: ColdStorageStockRecord) => {
    onSelect(record)
    setShowResults(false)
    setLotNoSearch("")
    setDescSearch("")
    setResults([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-600">
            Search Cold Storage Stock
          </span>
        </div>
        <Select
          value={coldCompany}
          onValueChange={(val) => {
            setColdCompany(val)
            setResults([])
            setShowResults(false)
          }}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs bg-white border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cfpl">CFPL</SelectItem>
            <SelectItem value="cdpl">CDPL</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Search by Lot Number</Label>
          <div className="relative">
            <Input
              value={lotNoSearch}
              onChange={(e) => setLotNoSearch(e.target.value)}
              placeholder="Type lot number..."
              className="pr-8"
            />
            {lotNoSearch && (
              <button
                type="button"
                onClick={() => {
                  setLotNoSearch("")
                  setResults([])
                  setShowResults(false)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs">
            Search by Group Name / Item Description
          </Label>
          <div className="relative">
            <Input
              value={descSearch}
              onChange={(e) => setDescSearch(e.target.value)}
              placeholder="Type group name or item description..."
              className="pr-8"
            />
            {descSearch && (
              <button
                type="button"
                onClick={() => {
                  setDescSearch("")
                  setResults([])
                  setShowResults(false)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching...
        </div>
      )}

      {showResults && !loading && results.length === 0 && (
        <div className="text-sm text-muted-foreground py-2">
          No results found.
        </div>
      )}

      {showResults && results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-sky-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Inward Dt</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Unit</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Item Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Item Mark</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700">Lot No</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Qty of Cartons</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Weight (kg)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Total Inv (kgs)</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {results.map((record, idx) => (
                  <tr
                    key={record.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{record.inward_dt || "-"}</td>
                    <td className="px-3 py-2">{record.unit || "-"}</td>
                    <td className="px-3 py-2 font-medium">{record.item_description || "-"}</td>
                    <td className="px-3 py-2">{record.item_mark || "-"}</td>
                    <td className="px-3 py-2 font-mono">{record.lot_no || "-"}</td>
                    <td className="px-3 py-2 text-right">{record.net_qty_on_cartons ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{record.weight_kg ?? "-"}</td>
                    <td className="px-3 py-2 text-right">
                      {record.net_qty_on_cartons != null && record.weight_kg != null
                        ? (record.net_qty_on_cartons * record.weight_kg).toFixed(2)
                        : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-3 text-xs"
                        onClick={() => handleSelect(record)}
                      >
                        Select
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-3 py-1.5 text-xs text-muted-foreground border-t">
            Showing {results.length} result{results.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ColdStorageDirectOutCreatePage({ params }: DirectOutPageProps) {
  const { company } = params
  const router = useRouter()
  const { toast } = useToast()
  const { accessToken } = useAuthStore()

  // Direct Out follows the navbar company switch (URL [company] segment).
  const activeCompany = company?.toUpperCase() === "CDPL" ? "CDPL" : "CFPL"

  const AUTHORITY_OPTIONS = ["B Hrithik", "Vaibhav Kumkar", "Samal Kumar", "Sumit Baikar"]
  const [authoritySelect, setAuthoritySelect] = useState("")
  const [authorityOther, setAuthorityOther] = useState("")
  const authorityPerson = authoritySelect === "__other__" ? authorityOther : authoritySelect
  const [currentDate, setCurrentDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [toCustomer, setToCustomer] = useState("")
  const [warehouse, setWarehouse] = useState("")
  const [vehicleNo, setVehicleNo] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [remarks, setRemarks] = useState("")

  const [lines, setLines] = useState<DirectOutLine[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleAddLine = (record: ColdStorageStockRecord) => {
    const existing = lines.find((l) => l.stockId === record.id)
    if (existing) {
      toast({
        title: "Already added",
        description: `Lot ${record.lot_no || ""} for ${record.item_description || ""} is already in the list.`,
      })
      return
    }

    const newLine: DirectOutLine = {
      rowId: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stockId: record.id,
      itemDescription: record.item_description || "",
      lotNo: record.lot_no || "",
      inwardNo: record.inward_no || "",
      itemMark: record.item_mark || "",
      availableQty: record.net_qty_on_cartons ?? 0,
      availableWeightKg: record.weight_kg ?? null,
      issueQty: record.net_qty_on_cartons ?? 0,
      uom: "CTN",
      warehouse: record.storage_location || record.unit || warehouse || "",
      unit: record.unit || "",
      boxId: record.box_id,
      transactionNo: record.transaction_no,
    }
    setLines((prev) => [...prev, newLine])
  }

  const updateLine = (rowId: string, field: keyof DirectOutLine, value: any) => {
    setLines((prev) =>
      prev.map((l) => (l.rowId === rowId ? { ...l, [field]: value } : l)),
    )
  }

  const removeLine = (rowId: string) => {
    setLines((prev) => prev.filter((l) => l.rowId !== rowId))
  }

  const totalIssueQty = lines.reduce((s, l) => s + (Number(l.issueQty) || 0), 0)
  const totalIssueWeight = lines.reduce((s, l) => {
    const wPerBox = l.availableWeightKg ?? 0
    return s + (Number(l.issueQty) || 0) * wPerBox
  }, 0)

  const validate = (): string | null => {
    if (!authorityPerson.trim()) return "Authority Person is required"
    if (!currentDate) return "Date is required"
    if (!toCustomer.trim()) return "To Customer / Party Name is required"
    // if (!warehouse) return "Warehouse is required"
    if (lines.length === 0) return "Add at least one stock line"
    for (const l of lines) {
      if (!l.issueQty || l.issueQty <= 0)
        return `Issue qty must be > 0 for ${l.itemDescription}`
      if (l.issueQty > l.availableQty)
        return `Issue qty exceeds available (${l.availableQty}) for ${l.itemDescription}`
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) {
      toast({ title: "Validation error", description: err, variant: "destructive" })
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        transaction_type: "DIRECT_OUT",
        company: activeCompany,
        entry_date: currentDate,
        authority_person: authorityPerson,
        to_customer: toCustomer,
        warehouse,
        vehicle_no: vehicleNo || null,
        invoice_no: invoiceNo || null,
        remarks: remarks || null,
        lines: lines.map((l) => ({
          stock_id: l.stockId,
          item_description: l.itemDescription,
          lot_no: l.lotNo,
          inward_no: l.inwardNo,
          item_mark: l.itemMark,
          issue_qty: l.issueQty,
          uom: l.uom,
          unit: l.unit,
          warehouse: l.warehouse,
          box_id: l.boxId,
          transaction_no: l.transactionNo,
          weight_kg_per_box: l.availableWeightKg,
        })),
      }

      const response = await fetch(`${API_URL}/cold-storage/direct-out`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let detail = `HTTP ${response.status}`
        try {
          const body = await response.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch {
          // ignore
        }
        throw new Error(detail)
      }

      toast({
        title: "Direct Out submitted",
        description: `${lines.length} line(s) issued to ${toCustomer}.`,
      })
      router.push(`/${company}/cold-storage/direct-out`)
    } catch (e: any) {
      console.error("Direct Out submit failed:", e)
      toast({
        title: "Submit failed",
        description: e?.message || "Could not submit direct out.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PermissionGuard module="cold-storage" action="create">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1400px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${company}/cold-storage/direct-out`)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight">
                Direct Out — Cold Storage
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Issue cold storage stock directly to a customer / party
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span>Submit</span>
          </Button>
        </div>

        {/* Top form fields */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Direct Out Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Authority Person <span className="text-red-500">*</span>
                </Label>
                <Select value={authoritySelect} onValueChange={(v) => { setAuthoritySelect(v); if (v !== "__other__") setAuthorityOther("") }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select authority person" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTHORITY_OPTIONS.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                    <SelectItem value="__other__">Other...</SelectItem>
                  </SelectContent>
                </Select>
                {authoritySelect === "__other__" && (
                  <Input
                    value={authorityOther}
                    onChange={(e) => setAuthorityOther(e.target.value)}
                    placeholder="Enter authority person name"
                    className="mt-1.5"
                  />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Current Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  To Customer / Party Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={toCustomer}
                  onChange={(e) => setToCustomer(e.target.value)}
                  placeholder="Customer or party name"
                />
              </div>
              {/* Warehouse field hidden — per-line warehouse comes from each stock row.
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Warehouse <span className="text-red-500">*</span>
                </Label>
                <Select value={warehouse} onValueChange={setWarehouse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {getColdWarehouseCodes().map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              */}
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle No</Label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Invoice No</Label>
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Invoice number"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label className="text-xs">Remarks</Label>
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardContent className="pt-4">
            <ColdStorageStockSearch onSelect={handleAddLine} company={activeCompany} />
          </CardContent>
        </Card>

        {/* Article Entries (single source of truth) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Article Entries
              <span className="text-xs text-muted-foreground font-normal">
                ({lines.length} line{lines.length !== 1 ? "s" : ""})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">No article entries yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Search and select cold storage stock above to add entries.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Sr</th>
                      <th className="text-left font-medium px-3 py-2">Item Description</th>
                      <th className="text-left font-medium px-3 py-2">Lot No</th>
                      <th className="text-right font-medium px-3 py-2">Available Qty</th>
                      <th className="text-right font-medium px-3 py-2">Issue Qty</th>
                      <th className="text-left font-medium px-3 py-2">UOM</th>
                      <th className="text-left font-medium px-3 py-2">Unit</th>
                      <th className="text-left font-medium px-3 py-2">Warehouse</th>
                      <th className="text-right font-medium px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, idx) => (
                      <tr
                        key={l.rowId}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-medium">
                          {l.itemDescription}
                          {l.itemMark && (
                            <span className="block text-xs text-muted-foreground">
                              {l.itemMark}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono">{l.lotNo}</td>
                        <td className="px-3 py-2 text-right">{l.availableQty}</td>
                        <td className="px-3 py-2 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={l.availableQty}
                            value={l.issueQty}
                            onChange={(e) =>
                              updateLine(
                                l.rowId,
                                "issueQty",
                                Number(e.target.value),
                              )
                            }
                            className="h-8 w-24 text-right ml-auto"
                          />
                        </td>
                        <td className="px-3 py-2">{l.uom}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {l.unit || "-"}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {l.warehouse || "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLine(l.rowId)}
                            className="h-7 w-7 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/30 border-t font-medium">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-right">
                        Totals
                      </td>
                      <td className="px-3 py-2 text-right">{totalIssueQty}</td>
                      <td colSpan={4} className="px-3 py-2 text-muted-foreground">
                        Approx. {totalIssueWeight.toFixed(2)} kg
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  )
}
