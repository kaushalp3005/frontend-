"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Send, Package, Plus, Trash2, Search, Loader2, X } from "lucide-react"
import type { Company } from "@/types/auth"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { ColdStorageApiService, type ColdStorageStockRecord } from "@/lib/api/coldStorageApiService"

interface InnerColdTransferPageProps {
  params: {
    company: Company
  }
}

// Cold Storage Stock Search component
function ColdStorageStockSearch({
  onSelect,
  storageLocation,
  company,
}: {
  onSelect: (record: ColdStorageStockRecord) => void
  storageLocation?: string
  company: string
}) {
  const [lotNoSearch, setLotNoSearch] = useState("")
  const [descSearch, setDescSearch] = useState("")
  const [results, setResults] = useState<ColdStorageStockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (lotNo: string, desc: string) => {
    if (!lotNo && !desc) {
      setResults([]); setShowResults(false); return
    }
    setLoading(true)
    try {
      const params: Record<string, string> = { limit: "200", company }
      if (lotNo.trim()) params.lot_no = lotNo.trim()
      if (desc.trim()) params.q = desc.trim()
      if (storageLocation) params.storage_location = storageLocation
      const data = await ColdStorageApiService.searchColdStorageStocks(params)
      setResults(data.results)
      setShowResults(true)
    } catch { setResults([]) } finally { setLoading(false) }
  }, [storageLocation, company])

  const handleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(lotNoSearch, descSearch), 400)
  }, [lotNoSearch, descSearch, doSearch])

  useEffect(() => {
    handleSearch()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [handleSearch])

  const handleSelect = (record: ColdStorageStockRecord) => {
    onSelect(record)
    setShowResults(false); setLotNoSearch(""); setDescSearch(""); setResults([])
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Search className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-600">Search Cold Storage Stock</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Search by Lot Number</Label>
          <div className="relative">
            <Input value={lotNoSearch} onChange={(e) => setLotNoSearch(e.target.value)} placeholder="Type lot number..." className="pr-8" />
            {lotNoSearch && (
              <button type="button" onClick={() => { setLotNoSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs">Search by Group Name / Item Description</Label>
          <div className="relative">
            <Input value={descSearch} onChange={(e) => setDescSearch(e.target.value)} placeholder="Type group name or item description..." className="pr-8" />
            {descSearch && (
              <button type="button" onClick={() => { setDescSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching...
        </div>
      )}
      {showResults && !loading && results.length === 0 && (
        <div className="text-sm text-muted-foreground py-2">No results found.</div>
      )}
      {showResults && results.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          {/* Mobile card list */}
          <div className="md:hidden max-h-[350px] overflow-y-auto divide-y">
            {results.map((record, idx) => (
              <div key={record.id} className="p-3 space-y-2 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{record.item_description || "-"}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {record.item_mark || "-"} | {record.inward_dt || "-"}
                    </p>
                  </div>
                  <Button size="sm" variant="default" className="h-7 px-3 text-xs shrink-0" onClick={() => handleSelect(record)}>Select</Button>
                </div>
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  <span className="bg-gray-100 px-2 py-0.5 rounded font-mono">Lot: {record.lot_no || "-"}</span>
                  <span className="text-muted-foreground">{record.net_qty_on_cartons ?? 0} cartons</span>
                  <span className="text-muted-foreground">{record.weight_kg ?? 0} kg</span>
                </div>
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto max-h-[300px] overflow-y-auto">
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
                  <tr key={record.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-3 py-2 text-gray-600">{idx + 1}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{record.inward_dt || "-"}</td>
                    <td className="px-3 py-2">{record.unit || "-"}</td>
                    <td className="px-3 py-2 font-medium">{record.item_description || "-"}</td>
                    <td className="px-3 py-2">{record.item_mark || "-"}</td>
                    <td className="px-3 py-2 font-mono">{record.lot_no || "-"}</td>
                    <td className="px-3 py-2 text-right">{record.net_qty_on_cartons ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{record.weight_kg ?? "-"}</td>
                    <td className="px-3 py-2 text-right">{(record.net_qty_on_cartons != null && record.weight_kg != null) ? (record.net_qty_on_cartons * record.weight_kg).toFixed(2) : "-"}</td>
                    <td className="px-3 py-2 text-center">
                      <Button size="sm" variant="default" className="h-7 px-3 text-xs" onClick={() => handleSelect(record)}>Select</Button>
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

export default function InnerColdTransferPage({ params }: InnerColdTransferPageProps) {
  const { company } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuthStore()

  const editChallan = searchParams.get('editChallan')
  const isEditMode = !!editChallan

  // Generate transfer number
  const generateTransferNo = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const h = String(now.getHours()).padStart(2, '0')
    const min = String(now.getMinutes()).padStart(2, '0')
    return `ICT${y}${m}${d}${h}${min}`
  }

  const [transferNo, setTransferNo] = useState(editChallan || generateTransferNo())
  const now = new Date()
  const currentDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

  // Cold storage warehouses — fetched from DB
  const [storageLocations, setStorageLocations] = useState<string[]>([])

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/storage-locations?company=${encodeURIComponent(company)}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (res.ok) {
          const data = await res.json()
          setStorageLocations(data)
        }
      } catch (err) {
        console.error('Failed to fetch storage locations:', err)
      }
    }
    fetchLocations()
  }, [])

  const [formData, setFormData] = useState({
    transferName: currentDate,
    fromWarehouse: "",
    reason: "",
    reasonDescription: ""
  })

  // Article interface
  interface Article {
    id: string
    stock_record_id: number | null
    item_category: string
    item_description: string
    net_weight: number
    available_boxes: number
    quantity_units: number
    lot_number: string
    new_lot_number: string
    change_location: boolean
    new_storage_location: string
    location_is_other: boolean
  }

  const [articles, setArticles] = useState<Article[]>([{
    id: "1", stock_record_id: null, item_category: "", item_description: "",
    net_weight: 0, available_boxes: 0, quantity_units: 0,
    lot_number: "", new_lot_number: "",
    change_location: false, new_storage_location: "", location_is_other: false,
  }])

  // Transfer list (added articles ready for submit)
  interface TransferEntry {
    id: string
    stock_record_id: number | null
    item_category: string
    item_description: string
    net_weight: number
    quantity_units: number
    old_lot_number: string
    new_lot_number: string
    new_storage_location: string
  }

  const [transferEntries, setTransferEntries] = useState<TransferEntry[]>([])
  const [editLoading, setEditLoading] = useState(false)

  // Load existing transfer data in edit mode
  useEffect(() => {
    if (!editChallan) return
    const loadEditData = async () => {
      setEditLoading(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/inner-transfer/${encodeURIComponent(editChallan)}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error('Failed to load transfer data')
        const data = await res.json()

        setTransferNo(data.challan_no)
        setFormData({
          transferName: data.transfer_date || currentDate,
          fromWarehouse: data.from_warehouse || '',
          reason: data.reason_code || '',
          reasonDescription: data.remark || '',
        })

        // Load lines into transfer entries
        const entries: TransferEntry[] = (data.lines || []).map((line: any, idx: number) => ({
          id: `edit-${idx}-${Date.now()}`,
          stock_record_id: line.stock_record_id,
          item_category: line.item_category || '',
          item_description: line.item_description || '',
          net_weight: line.net_weight_kg || 0,
          quantity_units: line.quantity || 0,
          old_lot_number: line.old_lot_number || '',
          new_lot_number: line.new_lot_number || '',
          new_storage_location: line.new_storage_location || '',
        }))
        setTransferEntries(entries)
      } catch (error: any) {
        console.error('Failed to load edit data:', error)
        toast({ title: "Error", description: error.message || "Failed to load transfer data for editing.", variant: "destructive" })
      } finally {
        setEditLoading(false)
      }
    }
    loadEditData()
  }, [editChallan])

  // Submitting state
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // ── Article Management ──

  const addArticle = () => {
    const newArticle: Article = {
      id: Date.now().toString(), stock_record_id: null, item_category: "", item_description: "",
      net_weight: 0, available_boxes: 0, quantity_units: 0,
      lot_number: "", new_lot_number: "",
      change_location: false, new_storage_location: "", location_is_other: false,
    }
    setArticles(prev => [...prev, newArticle])
  }

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      setArticles(prev => prev.filter(a => a.id !== id))
      toast({ title: "Article Removed", description: "Article has been removed successfully." })
    } else {
      toast({ title: "Cannot Remove", description: "At least one article is required.", variant: "destructive" })
    }
  }

  const updateArticle = (id: string, field: string, value: any) => {
    setArticles(prev => prev.map(article => {
      if (article.id !== id) return article
      return { ...article, [field]: value }
    }))
  }

  // ── Cold Storage Stock Selection ──

  const handleSelectColdStorageStock = (articleId: string, record: ColdStorageStockRecord) => {
    const availableBoxes = record.net_qty_on_cartons ? Math.ceil(record.net_qty_on_cartons) : 0
    setArticles(prev =>
      prev.map(article => {
        if (article.id !== articleId) return article
        return {
          ...article,
          stock_record_id: record.id,
          item_category: record.group_name || "",
          item_description: record.item_description || "",
          lot_number: record.lot_no ? String(record.lot_no) : "",
          net_weight: record.weight_kg ?? 0,
          available_boxes: availableBoxes,
          quantity_units: 0,
          new_lot_number: "",
          change_location: false,
          new_storage_location: "",
          location_is_other: false,
        }
      })
    )
    toast({
      title: "Stock Selected",
      description: `Filled from stock: ${record.item_description || "N/A"} - Lot ${record.lot_no || "N/A"}`,
    })
  }

  // ── Add article to transfer list ──

  const handleAddToList = (article: Article) => {
    if (!article.item_description) {
      toast({ title: "Missing Fields", description: "Please select a stock item first", variant: "destructive" })
      return
    }
    if (!article.quantity_units || article.quantity_units <= 0) {
      toast({ title: "Missing Fields", description: "Please enter No. of Boxes", variant: "destructive" })
      return
    }
    if (!article.new_lot_number.trim()) {
      toast({ title: "Missing Fields", description: "Please enter the New Lot Number", variant: "destructive" })
      return
    }
    if (article.change_location && !article.new_storage_location) {
      toast({ title: "Missing Fields", description: "Please select the New Storage Location", variant: "destructive" })
      return
    }

    const entry: TransferEntry = {
      id: Date.now().toString(),
      stock_record_id: article.stock_record_id,
      item_category: article.item_category,
      item_description: article.item_description,
      net_weight: article.net_weight,
      quantity_units: article.quantity_units,
      old_lot_number: article.lot_number,
      new_lot_number: article.new_lot_number,
      new_storage_location: article.change_location ? article.new_storage_location : "",
    }

    setTransferEntries(prev => [...prev, entry])
    toast({ title: "Added to Transfer List", description: `${article.item_description}: ${article.quantity_units} boxes, Lot ${article.lot_number} → ${article.new_lot_number}` })
  }

  const handleRemoveEntry = (entryId: string) => {
    setTransferEntries(prev => prev.filter(e => e.id !== entryId))
    toast({ title: "Entry Removed", description: "Entry removed from transfer list" })
  }

  // ── Submit ──

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors: string[] = []
    if (!formData.fromWarehouse) errors.push('Inner Stock Transfer selection is required')
    if (!formData.reason) errors.push('Reason is required')
    if (!formData.reasonDescription?.trim()) errors.push('Reason description is required')
    if (transferEntries.length === 0) errors.push('Please add at least one article to the transfer list')

    if (errors.length > 0) {
      setValidationErrors(errors)
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" })
      return
    }

    setValidationErrors([])
    setSubmitting(true)

    try {
      // In edit mode, delete the old transfer records first
      if (isEditMode && editChallan) {
        const deleteUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/inner-transfer/${encodeURIComponent(editChallan)}?user_email=${encodeURIComponent(user?.email || '')}`
        const delRes = await fetch(deleteUrl, { method: 'DELETE', headers: { 'Accept': 'application/json' } })
        if (!delRes.ok) {
          const errData = await delRes.json().catch(() => null)
          throw new Error(errData?.detail || 'Failed to update: could not remove old records')
        }
      }

      const payload = {
        company: company,
        header: {
          challan_no: transferNo,
          transfer_name: formData.transferName,
          from_warehouse: formData.fromWarehouse,
          remark: formData.reasonDescription || formData.reason,
          reason_code: formData.reason,
          transfer_type: "INNER_COLD",
        },
        lines: transferEntries.map((entry) => ({
          stock_record_id: entry.stock_record_id,
          item_category: entry.item_category,
          item_description: entry.item_description,
          net_weight: entry.net_weight,
          quantity: entry.quantity_units,
          old_lot_number: entry.old_lot_number,
          new_lot_number: entry.new_lot_number,
          new_storage_location: entry.new_storage_location || null,
        })),
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/cold-storage/inner-transfer`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || `Submit failed: ${response.status}`)
      }

      const result = await response.json()
      console.log('Inner transfer result:', result)

      if (result.errors && result.errors.length > 0) {
        toast({ title: "Partial Success", description: `Updated ${result.updated_records} record(s). Errors: ${result.errors.join(', ')}`, variant: "destructive" })
        return
      }

      toast({ title: isEditMode ? "Transfer Updated" : "Transfer Submitted", description: `Inner Cold Transfer ${transferNo} ${isEditMode ? 'updated' : 'submitted'} successfully. ${result.updated_records} record(s) updated.` })
      router.push(`/${company}/transfer`)
    } catch (error: any) {
      console.error('Submit error:', error)
      toast({ title: "Submit Failed", description: error.message || "Failed to submit transfer", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  if (editLoading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading transfer data...</span>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="min-h-screen bg-gray-50/50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">

        {/* Top Navigation */}
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(`/${company}/transfer`)}
            className="h-8 px-2 text-gray-600 hover:text-gray-800">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">{isEditMode ? 'Edit Inner Cold Transfer' : 'Inner Cold Transfer'}</h1>
            <p className="text-xs text-muted-foreground">Transfer No: {transferNo}</p>
          </div>
        </div>

        {/* ── Request Header Section ── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Request Header</CardTitle>
            <p className="text-xs text-muted-foreground">Transfer details between cold storage locations</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-4">
              {/* Transfer No */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Transfer No</Label>
                <Input value={transferNo} readOnly className="h-9 bg-gray-50 border-gray-200 text-gray-500 font-semibold cursor-not-allowed" />
              </div>

              {/* Transfer Date */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Transfer Date *</Label>
                <Input type="text" value={formData.transferName}
                  onChange={(e) => handleInputChange('transferName', e.target.value)}
                  className="h-9 bg-white border-gray-200" placeholder="DD-MM-YYYY" />
              </div>

              {/* Inner Stock Transfer */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Inner Stock Transfer *</Label>
                <Select value={formData.fromWarehouse} onValueChange={(value) => handleInputChange('fromWarehouse', value)}>
                  <SelectTrigger className="h-9 bg-white border-gray-200">
                    <SelectValue placeholder="Select cold storage" />
                  </SelectTrigger>
                  <SelectContent>
                    {storageLocations.map(wh => (
                      <SelectItem key={wh} value={wh}>{wh}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Reason *</Label>
                <Select value={formData.reason} onValueChange={(value) => handleInputChange('reason', value)}>
                  <SelectTrigger className="h-9 bg-white border-gray-200">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Stock Requirement">Stock Requirement</SelectItem>
                    <SelectItem value="Material Movement">Material Movement</SelectItem>
                    <SelectItem value="Inventory Balancing">Inventory Balancing</SelectItem>
                    <SelectItem value="Space Management">Space Management</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason Description */}
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Reason Description *</Label>
                <Textarea value={formData.reasonDescription}
                  onChange={(e) => handleInputChange('reasonDescription', e.target.value)}
                  className="w-full min-h-[60px] bg-white border-gray-300 text-gray-700"
                  placeholder="Enter short description about reason..." />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Article Entry Section ── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-cyan-100 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-cyan-600" />
              </div>
              Article Entry
            </h2>
            <Button type="button" onClick={addArticle} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
              <Plus className="mr-2 h-3.5 w-3.5" /> Add Article
            </Button>
          </div>

          {/* Articles */}
          <div className="space-y-6">
            {articles.map((article) => (
              <div key={article.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Article Entry</h4>
                  <div className="flex items-center gap-2">
                    {articles.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeArticle(article.id)}
                        className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Cold Storage Stock Search */}
                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3">
                  <ColdStorageStockSearch
                    onSelect={(record) => handleSelectColdStorageStock(article.id, record)}
                    storageLocation={formData.fromWarehouse || undefined}
                    company={company}
                  />
                </div>

                {/* Auto-filled fields from cold storage stock selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Item Category</Label>
                    <Input value={article.item_category} readOnly placeholder="Auto-filled from stock selection" className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Item Description</Label>
                    <Input value={article.item_description} readOnly placeholder="Auto-filled from stock selection" className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input value={article.net_weight || ""} readOnly placeholder="Auto-filled" className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Total Weight (kgs)</Label>
                    <Input value={article.quantity_units && article.net_weight ? (article.quantity_units * article.net_weight).toFixed(2) : ""} readOnly placeholder="Auto-calculated" className="bg-muted" />
                  </div>
                </div>

                {/* Editable fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">No. of Boxes/Cartons *</Label>
                    <Input type="number" min="1"
                      max={article.available_boxes || undefined}
                      value={article.quantity_units || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0
                        if (article.available_boxes > 0 && val > article.available_boxes) {
                          toast({ title: "Limit Exceeded", description: `Maximum available boxes: ${article.available_boxes}`, variant: "destructive" })
                          updateArticle(article.id, "quantity_units", article.available_boxes)
                        } else {
                          updateArticle(article.id, "quantity_units", val)
                        }
                      }}
                      placeholder="Enter count" />
                    {article.available_boxes > 0 && (
                      <p className="text-[10px] text-muted-foreground">Available: {article.available_boxes} boxes</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Old Lot Number</Label>
                    <Input value={article.lot_number} readOnly placeholder="Auto-filled from stock" className="bg-muted font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">New Lot Number *</Label>
                    <Input value={article.new_lot_number}
                      onChange={(e) => updateArticle(article.id, "new_lot_number", e.target.value)}
                      placeholder="Enter new lot number"
                      className="border-orange-300 focus:border-orange-500 font-mono" />
                  </div>
                </div>

                {/* Change Location Option */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`change-location-${article.id}`}
                      checked={article.change_location}
                      onCheckedChange={(checked) => {
                        updateArticle(article.id, "change_location", !!checked)
                        if (!checked) {
                          updateArticle(article.id, "new_storage_location", "")
                          updateArticle(article.id, "location_is_other", false)
                        }
                      }}
                    />
                    <Label htmlFor={`change-location-${article.id}`} className="text-xs font-medium cursor-pointer">
                      Change Storage Location?
                    </Label>
                  </div>
                  {article.change_location && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">New Storage Location *</Label>
                        <Select
                          value={article.location_is_other ? "__other__" : article.new_storage_location}
                          onValueChange={(value) => {
                            if (value === "__other__") {
                              updateArticle(article.id, "location_is_other", true)
                              updateArticle(article.id, "new_storage_location", "")
                            } else {
                              updateArticle(article.id, "location_is_other", false)
                              updateArticle(article.id, "new_storage_location", value)
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 bg-white border-purple-300 focus:border-purple-500">
                            <SelectValue placeholder="Select new location" />
                          </SelectTrigger>
                          <SelectContent>
                            {storageLocations.filter(loc => !loc.toLowerCase().startsWith("kala namak")).map(loc => (
                              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                            ))}
                            <SelectItem value="__other__">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {article.location_is_other && (
                        <div className="space-y-1">
                          <Label className="text-xs">Enter Location Name *</Label>
                          <Input
                            value={article.new_storage_location}
                            onChange={(e) => updateArticle(article.id, "new_storage_location", e.target.value)}
                            placeholder="Type custom location name"
                            className="h-9 border-purple-300 focus:border-purple-500"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Add to List Button */}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <Button type="button" onClick={() => handleAddToList(article)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 px-5 text-xs sm:text-sm w-full sm:w-auto">
                    <Plus className="mr-2 h-3.5 w-3.5" /> Add to Transfer List
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Transfer List Section ── */}
        <Card className="w-full bg-white border-gray-200">
          <CardHeader className="pb-3 bg-gray-50 px-3 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Transfer List ({transferEntries.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Lot number changes to be applied</p>
              </div>
              {transferEntries.length > 0 && (
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setTransferEntries([])}
                  className="h-8 px-3 text-xs text-red-600 border-red-200 hover:bg-red-50">
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {transferEntries.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">No entries added yet</p>
                <p className="text-xs text-gray-400 mt-1">Select stock, enter boxes &amp; new lot number, then click &quot;Add to Transfer List&quot;</p>
              </div>
            ) : (
              <>
                {/* Mobile card list */}
                <div className="md:hidden divide-y">
                  {transferEntries.map((entry, idx) => (
                    <div key={entry.id} className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.item_description}</p>
                          <p className="text-[11px] text-muted-foreground">{entry.item_category}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm"
                          onClick={() => handleRemoveEntry(entry.id)}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        <span className="font-medium">{entry.quantity_units} boxes</span>
                        <span className="text-muted-foreground">{entry.net_weight} kg</span>
                        <span className="text-muted-foreground">Total: {(entry.quantity_units * entry.net_weight).toFixed(2)} kgs</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="font-mono text-gray-500">{entry.old_lot_number}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-mono font-semibold text-orange-700">{entry.new_lot_number}</span>
                      </div>
                      {entry.new_storage_location && (
                        <p className="text-xs text-purple-700 font-medium">New Location: {entry.new_storage_location}</p>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Item Description</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Boxes</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Weight (kg)</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">Total Wt (kgs)</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">Old Lot No</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">New Lot No</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">New Location</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferEntries.map((entry, idx) => (
                        <tr key={entry.id} className="border-b hover:bg-gray-50">
                          <td className="px-3 py-2">{idx + 1}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{entry.item_description}</td>
                          <td className="px-3 py-2">{entry.item_category}</td>
                          <td className="px-3 py-2 text-right font-medium">{entry.quantity_units}</td>
                          <td className="px-3 py-2 text-right">{entry.net_weight}</td>
                          <td className="px-3 py-2 text-right">{(entry.quantity_units * entry.net_weight).toFixed(2)}</td>
                          <td className="px-3 py-2 font-mono text-gray-500">{entry.old_lot_number}</td>
                          <td className="px-3 py-2 font-mono font-semibold text-orange-700">{entry.new_lot_number}</td>
                          <td className="px-3 py-2 text-purple-700 font-medium">{entry.new_storage_location || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <Button type="button" variant="ghost" size="sm"
                              onClick={() => handleRemoveEntry(entry.id)}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-red-800 mb-2">Please fix the following errors:</h4>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i} className="text-xs text-red-700">{err}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Submit Button */}
        <div className="flex justify-end pb-6">
          <Button type="submit" disabled={submitting || transferEntries.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 text-sm">
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> {isEditMode ? 'Update Inner Cold Transfer' : 'Submit Inner Cold Transfer'}</>
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}
