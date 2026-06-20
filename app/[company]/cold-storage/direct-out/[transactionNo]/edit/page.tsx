"use client"

import React, { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Save, Loader2, AlertCircle, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PermissionGuard } from "@/components/auth/permission-gate"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { getColdWarehouseCodes } from "@/lib/constants/warehouses"

interface PageProps {
  params: { company: string; transactionNo: string }
}

interface DirectOutRecord {
  id?: number
  transaction_no?: string
  entry_date?: string | null
  authority_person?: string | null
  to_customer?: string | null
  warehouse?: string | null
  vehicle_no?: string | null
  invoice_no?: string | null
  remarks?: string | null
  lines?: any[]
  line_count?: number | null
  total_issue_qty?: number | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const AUTHORITY_OPTIONS = ["B Hrithik", "Vaibhav Kumkar", "Samal Kumar", "Sumit Baikar"]

export default function DirectOutEditPage({ params }: PageProps) {
  const { company, transactionNo } = params
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const { toast } = useToast()

  const activeCompany = company?.toUpperCase() === "CDPL" ? "CDPL" : "CFPL"

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [record, setRecord] = useState<DirectOutRecord | null>(null)

  const [entryDate, setEntryDate] = useState("")
  const [authoritySelect, setAuthoritySelect] = useState("")
  const [authorityOther, setAuthorityOther] = useState("")
  const [toCustomer, setToCustomer] = useState("")
  const [warehouse, setWarehouse] = useState("")
  const [vehicleNo, setVehicleNo] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [remarks, setRemarks] = useState("")

  const authorityPerson = authoritySelect === "__other__" ? authorityOther : authoritySelect

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const url = `${API_URL}/cold-storage/direct-out/${activeCompany}/${encodeURIComponent(transactionNo)}`
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })
      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      const r: DirectOutRecord = await res.json()
      setRecord(r)
      setEntryDate(r.entry_date ? String(r.entry_date).slice(0, 10) : "")
      const auth = r.authority_person || ""
      if (auth && AUTHORITY_OPTIONS.includes(auth)) {
        setAuthoritySelect(auth)
        setAuthorityOther("")
      } else if (auth) {
        setAuthoritySelect("__other__")
        setAuthorityOther(auth)
      }
      setToCustomer(r.to_customer || "")
      setWarehouse(r.warehouse || "")
      setVehicleNo(r.vehicle_no || "")
      setInvoiceNo(r.invoice_no || "")
      setRemarks(r.remarks || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load record")
    } finally {
      setLoading(false)
    }
  }, [activeCompany, transactionNo, accessToken])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!authorityPerson.trim()) {
      toast({ title: "Validation error", description: "Authority Person is required", variant: "destructive" })
      return
    }
    if (!entryDate) {
      toast({ title: "Validation error", description: "Date is required", variant: "destructive" })
      return
    }
    if (!toCustomer.trim()) {
      toast({ title: "Validation error", description: "To Customer is required", variant: "destructive" })
      return
    }

    setSaving(true)
    try {
      const url = `${API_URL}/cold-storage/direct-out/${activeCompany}/${encodeURIComponent(transactionNo)}`
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          entry_date: entryDate,
          authority_person: authorityPerson,
          to_customer: toCustomer,
          warehouse: warehouse || null,
          vehicle_no: vehicleNo || null,
          invoice_no: invoiceNo || null,
          remarks: remarks || null,
        }),
      })
      if (!res.ok) {
        let detail = `HTTP ${res.status}`
        try {
          const body = await res.json()
          const raw = body.detail || body.message || body
          detail = typeof raw === "string" ? raw : JSON.stringify(raw)
        } catch { /* ignore */ }
        throw new Error(detail)
      }
      toast({ title: "Saved", description: `${transactionNo} has been updated.` })
      router.push(`/${company}/cold-storage/direct-out/${encodeURIComponent(transactionNo)}`)
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PermissionGuard module="cold-storage" action="view">
      <div className="p-3 sm:p-4 md:p-6 max-w-[1100px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost" size="sm"
              onClick={() => router.push(`/${company}/cold-storage/direct-out/${encodeURIComponent(transactionNo)}`)}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight truncate">
                Edit — {transactionNo}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Header fields only. To change article entries, delete and recreate.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save</span>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Header fields */}
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <h2 className="text-sm font-semibold">Direct Out Details</h2>
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
                      value={entryDate}
                      onChange={(e) => setEntryDate(e.target.value)}
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
                      placeholder="Optional notes"
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Read-only article entries (just for context) */}
            <Card>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Article Entries (read-only)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {(record?.lines?.length ?? 0)} item(s)
                  </p>
                </div>
                <div className="px-4 py-3 text-xs text-muted-foreground">
                  Article entries cannot be modified here — they are linked to stock
                  movements. Anyone can edit the header fields above; only deletion
                  is restricted (admin-only). To change items, ask the admin to
                  delete this Direct Out and recreate it.
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}
