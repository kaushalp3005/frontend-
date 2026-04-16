"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useItemCategories, useSubCategories, useCategorialItemDescriptions } from "@/lib/hooks/useDropdownData"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { dropdownApi } from "@/lib/api"
import { ColdStorageApiService, type ColdStorageStockRecord } from "@/lib/api/coldStorageApiService"
import HighPerformanceQRScanner from "@/components/transfer/high-performance-qr-scanner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  ArrowLeft, Plus, Trash2, Loader2, Search, X, Camera,
  Send, RefreshCw, Truck, User, ClipboardList, Copy, Check
} from "lucide-react"
import type { Company } from "@/types/auth"
import { useAuthStore } from "@/lib/stores/auth"
import { useToast } from "@/hooks/use-toast"
import { useFormPersistence } from "@/hooks/useFormPersistence"

interface MaterialOutPageProps {
  params: {
    company: Company
  }
}

// ─── Material Type Dropdown ───
function MaterialTypeDropdown({
  value, onValueChange, company, error
}: {
  value: string; onValueChange: (v: string) => void; company: Company; error?: string
}) {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const data = await dropdownApi.fetchDropdown({ company, limit: 1000 })
        if (data.options?.material_types?.length) {
          const allowed = ['RM', 'PM', 'FG']
          setOptions(data.options.material_types.filter((t: string) => allowed.includes(t.toUpperCase())).map((t: string) => ({ value: t, label: t })))
        } else throw new Error()
      } catch {
        setOptions([{ value: "RM", label: "RM" }, { value: "PM", label: "PM" }, { value: "FG", label: "FG" }])
      } finally { setLoading(false) }
    }
    fetch()
  }, [])

  return (
    <SearchableSelect value={value || ""} onValueChange={onValueChange} placeholder="Select material type..."
      searchPlaceholder="Search..." options={options} loading={loading} disabled={loading || !options.length}
      className={error ? "border-red-500" : ""} />
  )
}

// ─── Item Category Dropdown ───
function ItemCategoryDropdown({
  materialType, value, onValueChange, company, error, disabled
}: {
  materialType: string; value: string; onValueChange: (v: string) => void; company: Company; error?: string; disabled?: boolean
}) {
  const hook = useItemCategories({ company, material_type: materialType })
  return (
    <SearchableSelect value={value} onValueChange={onValueChange} placeholder="Select category..."
      searchPlaceholder="Search..." options={hook.options} loading={hook.loading} error={hook.error}
      disabled={disabled || !materialType} className={error ? "border-red-500" : ""} />
  )
}

// ─── Sub Category Dropdown ───
function SubCategoryDropdown({
  categoryId, value, onValueChange, company, error, disabled, materialType
}: {
  categoryId: string; value: string; onValueChange: (v: string) => void; company: Company; error?: string; disabled?: boolean; materialType?: string
}) {
  const hook = useSubCategories(categoryId, { company, material_type: materialType })
  return (
    <SearchableSelect value={value} onValueChange={onValueChange} placeholder="Select sub category..."
      searchPlaceholder="Search..." options={hook.options} loading={hook.loading} error={hook.error}
      disabled={disabled || !categoryId} className={error ? "border-red-500" : ""} />
  )
}

// ─── Item Description Dropdown ───
function ItemDescriptionDropdown({
  articleId, categoryId, subCategoryId, materialType, value, onValueChange, company, error, updateArticle, disabled
}: {
  articleId: string; categoryId: string; subCategoryId: string; materialType: string; value: string
  onValueChange: (v: string) => void; company: Company; error?: string
  updateArticle?: (id: string, field: string, value: any) => void; disabled?: boolean
}) {
  const hook = useCategorialItemDescriptions({ material_type: materialType, item_category: categoryId, sub_category: subCategoryId })

  const handleChange = async (selectedValue: string) => {
    const opt = hook.options.find(o => o.value === selectedValue)
    if (opt && updateArticle) {
      updateArticle(articleId, "item_description", opt.label)
      if (opt.uom != null) updateArticle(articleId, "unit_pack_size", Number(opt.uom))
      updateArticle(articleId, "sku_id", null)
      try {
        const skuRes = await dropdownApi.fetchSkuId({ company, item_description: opt.label, item_category: categoryId, sub_category: subCategoryId, material_type: materialType })
        const skuId = Number(skuRes?.sku_id ?? skuRes?.id)
        if (skuId && !Number.isNaN(skuId) && skuId > 0) updateArticle(articleId, "sku_id", skuId)
      } catch { updateArticle(articleId, "sku_id", null) }
    }
    onValueChange(selectedValue)
  }

  return (
    <SearchableSelect value={value} onValueChange={handleChange} placeholder="Select item..."
      searchPlaceholder="Search..." options={hook.options} loading={hook.loading} error={hook.error}
      disabled={disabled || !categoryId || !subCategoryId} className={error ? "border-red-500" : ""} />
  )
}

// ─── Cold Storage Warehouses ───
const COLD_STORAGE_WAREHOUSES = ["Cold storage"]

// ─── Cold Storage Stock Search Component ───
function ColdStorageStockSearch({
  onSelect,
  company,
}: {
  onSelect: (record: ColdStorageStockRecord, coldCompany: string) => void
  company: string
}) {
  const [coldCompany, setColdCompany] = useState(company.toLowerCase())
  const [lotNoSearch, setLotNoSearch] = useState("")
  const [descSearch, setDescSearch] = useState("")
  const [results, setResults] = useState<ColdStorageStockRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (lotNo: string, desc: string) => {
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
  }, [coldCompany])

  const handleSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(lotNoSearch, descSearch)
    }, 400)
  }, [lotNoSearch, descSearch, doSearch])

  useEffect(() => {
    handleSearch()
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [handleSearch])

  const handleSelect = (record: ColdStorageStockRecord) => {
    onSelect(record, coldCompany)
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
          <span className="text-sm font-medium text-blue-600">Search Cold Storage Stock</span>
        </div>
        <Select value={coldCompany} onValueChange={(val) => { setColdCompany(val); setResults([]); setShowResults(false) }}>
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
            <Input value={lotNoSearch} onChange={(e) => setLotNoSearch(e.target.value)}
              placeholder="Type lot number..." className="pr-8" />
            {lotNoSearch && (
              <button type="button" onClick={() => { setLotNoSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div>
          <Label className="text-xs">Search by Group Name / Item Description</Label>
          <div className="relative">
            <Input value={descSearch} onChange={(e) => setDescSearch(e.target.value)}
              placeholder="Type group name or item description..." className="pr-8" />
            {descSearch && (
              <button type="button" onClick={() => { setDescSearch(""); setResults([]); setShowResults(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
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
                      <Button type="button" size="sm" variant="default" className="h-7 px-3 text-xs" onClick={() => handleSelect(record)}>
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

// ─── Article Interface ───
interface Article {
  id: string
  sku_id?: number | null
  material_type: string
  item_description: string
  item_category: string
  sub_category: string
  quantity_units: number
  packaging_type: number
  unit_pack_size: number
  uom: string
  net_weight: number
  total_weight: number
  batch_number: string
  lot_number: string
  manufacturing_date: string
  expiry_date: string
  hsn_sac: string
  gst_rate: string
  rate_per_kg: number
  amount: number
  line_remarks: string
  cs_max_boxes: number | null
  cs_box_id: string | null
  cs_transaction_no: string | null
  cs_inward_no: string | null
  cold_company: string
  item_mark: string
}

// ─── Job Work Entry (line item in articles list) ───
interface JobWorkEntry {
  id: number
  itemDescription: string
  materialType: string
  itemCategory: string
  subCategory: string
  quantity: string
  uom: string
  packSize: string
  unitPackSize: string
  netWeight: string
  totalWeight: string
  batchNumber: string
  lotNumber: string
  manufacturingDate: string
  expiryDate: string
  hsnSac: string
  gstRate: string
  ratePerKg: string
  amount: string
  lineRemarks: string
  coldUnit?: string
  itemMark?: string
  boxId?: string
  transactionNo?: string
  coldStockSnapshot?: Record<string, any> | null
}

let _articleIdCounter = 0
const emptyArticle = (): Article => ({
  id: `art_${Date.now()}_${++_articleIdCounter}`,
  sku_id: null,
  material_type: "",
  item_description: "",
  item_category: "",
  sub_category: "",
  quantity_units: 0,
  packaging_type: 0,
  unit_pack_size: 0,
  uom: "",
  net_weight: 0,
  total_weight: 0,
  batch_number: "",
  lot_number: "",
  manufacturing_date: "",
  expiry_date: "",
  hsn_sac: "08041020",
  gst_rate: "0%",
  rate_per_kg: 0,
  amount: 0,
  line_remarks: "",
  cs_max_boxes: null,
  cs_box_id: null,
  cs_transaction_no: null,
  cs_inward_no: null,
  cold_company: "",
  item_mark: "",
})

export default function MaterialOutPage({ params }: MaterialOutPageProps) {
  const { company } = params
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { user } = useAuthStore()

  // Edit mode
  const editId = searchParams.get('edit')
  const isEditMode = !!editId
  const [editLoading, setEditLoading] = useState(false)

  const now = new Date()
  const currentDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

  const generateChallanNo = () => {
    const d = new Date()
    return `JB${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  }

  const [challanNo, setChallanNo] = useState(generateChallanNo())

  const [headerData, setHeaderData] = useState({
    jobWorkDate: currentDate,
    fromWarehouse: "",
    toParty: "",
    partyAddress: "",
    contactPerson: "",
    contactNumber: "",
    purposeOfWork: "",
    expectedReturnDate: "",
    remarks: "",
    e_way_bill_no: "",
    dispatched_through: "",
  })

  const vendorList = [
    {
      name: "UNAZO CORPORATION", address: "SHOP NO-F/54, SECTOR-19, Turbhe, Navi Mumbai, Thane, Maharashtra, 400705",
      state: "MAHARASHTRA", city: "Thane", pin_code: "400705",
      contact_company: "9022223701", contact_mobile: "9022223701", email: "trishul@unazoccorp.com", sub_category: "",
    },
    {
      name: "Krishnat Kerba Chavan", address: "Shivshakti, SOC, Plot No-104,Room No-255,sec-4,Ghansoli,N.Mumbai 400701",
      state: "MAHARASHTRA", city: "Thane", pin_code: "400701",
      contact_company: "9766344318", contact_mobile: "9766344318", email: "krishnatchavan40@gmail.com", sub_category: "De seeding",
    },
    {
      name: "AL SAKHI ENTERPRISES", address: "BAGDE, ROOM NO. 1341, INDIRA NAGAR, TURBHE, NAVI MUMBAI, Thane, Maharashtra, 400703",
      state: "MAHARASHTRA", city: "NAVI MUMBAI", pin_code: "400703",
      contact_company: "9321792727", contact_mobile: "8850063004", email: "alsakhienterprises27@gmail.com", sub_category: "",
    },
    {
      name: "MIE FOODS INDIA PRIVATE LIMITED", address: "N 2301, 23rd Floor, Lodha World One, Senapati Bapat Marg, Upper Worli, Mumbai - 400013",
      state: "MAHARASHTRA", city: "MUMBAI", pin_code: "400013",
      contact_company: "7741960810", contact_mobile: "", email: "", sub_category: "",
    },
    {
      name: "HAG CORPORATION", address: "E 51, Phase II Market I, Turbhe, Navi Mumbai - 400705 | Factory: Plot No D 10/4, Turbhe MIDC, Navi Mumbai - 400703",
      state: "MAHARASHTRA", city: "NAVI MUMBAI (TURBHE)", pin_code: "400705",
      contact_company: "9321161659", contact_mobile: "9321161659", email: "hajigodil@gmail.com", sub_category: "",
    },
  ]

  const handleVendorSelect = (vendorName: string) => {
    const vendor = vendorList.find(v => v.name === vendorName)
    if (vendor) {
      setDispatchTo({ ...vendor })
      setSubCatIsOther(!subCatOptions.includes(vendor.sub_category) && vendor.sub_category !== "")
    } else {
      setDispatchTo(prev => ({ ...prev, name: vendorName }))
    }
  }

  const [dispatchTo, setDispatchTo] = useState({
    name: "",
    address: "",
    state: "Maharashtra",
    city: "",
    pin_code: "",
    contact_company: "",
    contact_mobile: "",
    email: "",
    sub_category: "",
  })

  const [transferInfo, setTransferInfo] = useState({
    vehicleNumber: "",
    vehicleNumberOther: "",
    driverName: "",
    driverNameOther: "",
    authorizedPerson: "",
  })

  const [articles, setArticles] = useState<Article[]>([emptyArticle()])
  const [articlesList, setArticlesList] = useState<JobWorkEntry[]>([])
  const entryIdRef = useRef(Date.now())

  const [submitting, setSubmitting] = useState(false)
  const subCatOptions = ["De seeding", "Dicing", "Cracking", "Stuffing", "Vacuum Packaging", "Slicing"]
  const [subCatIsOther, setSubCatIsOther] = useState(false)

  // Item quick search
  const [itemSearchQuery, setItemSearchQuery] = useState<Record<string, string>>({})
  const [itemSearchResults, setItemSearchResults] = useState<Record<string, any[]>>({})
  const [itemSearchLoading, setItemSearchLoading] = useState<Record<string, boolean>>({})
  const [itemSearchOpen, setItemSearchOpen] = useState<Record<string, boolean>>({})
  const searchTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // QR Scanner + Manual box entry state
  const [showScanner, setShowScanner] = useState(false)
  const isProcessingRef = useRef(false)
  const [manualBoxId, setManualBoxId] = useState("")
  const [manualTransactionNo, setManualTransactionNo] = useState("")
  const [manualBoxLoading, setManualBoxLoading] = useState(false)

  // Handle manual box fetch — lookup by box_id + transaction_no
  const handleManualBoxFetch = async () => {
    if (!manualBoxId.trim() || !manualTransactionNo.trim()) {
      toast({ title: "Missing Fields", description: "Enter both Box Number and Transaction No", variant: "destructive" })
      return
    }

    // Check for duplicate
    const isDuplicate = articlesList.some(
      (e) => e.boxId === manualBoxId.trim() && e.transactionNo === manualTransactionNo.trim()
    )
    if (isDuplicate) {
      toast({ title: "Duplicate Box", description: "This box has already been added", variant: "destructive" })
      return
    }

    setManualBoxLoading(true)
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/box-lookup/${company}?box_number=${encodeURIComponent(manualBoxId.trim())}&transaction_no=${encodeURIComponent(manualTransactionNo.trim())}`
      const response = await fetch(apiUrl)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || `Box not found (${response.status})`)
      }

      const data = await response.json()
      const boxData = data.box

      const netWeight = parseFloat(boxData.net_weight || 0)
      const grossWeight = parseFloat(boxData.gross_weight || boxData.net_weight || 0)

      const entry: JobWorkEntry = {
        id: entryIdRef.current++,
        itemDescription: boxData.item_description || boxData.article_description || '',
        materialType: boxData.material_type || '',
        itemCategory: boxData.item_category || '',
        subCategory: boxData.sub_category || '',
        quantity: "1",
        uom: boxData.uom || "KG",
        packSize: String(boxData.packaging_type || 0),
        unitPackSize: String(boxData.unit_pack_size || 0),
        netWeight: String(netWeight),
        totalWeight: String(grossWeight > 0 ? grossWeight : netWeight),
        batchNumber: boxData.batch_number || "",
        lotNumber: boxData.lot_number || "",
        manufacturingDate: boxData.manufacturing_date || "",
        expiryDate: boxData.expiry_date || "",
        hsnSac: "08041020",
        gstRate: "0%",
        ratePerKg: "0",
        amount: "0",
        lineRemarks: "",
        boxId: boxData.box_id || manualBoxId.trim(),
        transactionNo: boxData.transaction_no || manualTransactionNo.trim(),
      }

      setArticlesList(prev => [...prev, entry])
      toast({ title: "Box Added", description: `${entry.itemDescription} | Box #${manualBoxId.trim()} | ${netWeight.toFixed(3)} kg` })

      // Clear inputs
      setManualBoxId("")
      setManualTransactionNo("")
    } catch (error: any) {
      toast({ title: "Box Not Found", description: error.message || "Could not find box with the given details", variant: "destructive" })
    } finally {
      setManualBoxLoading(false)
    }
  }

  // QR Scan success handler
  const handleQRScanSuccess = async (decodedText: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setShowScanner(false)

    try {
      const qrData = JSON.parse(decodedText)
      const isBulkEntryQR = qrData.tx && qrData.tx.startsWith('BE')
      const isNewQRFormat = qrData.tx && qrData.bi && !isBulkEntryQR
      const transactionNo = qrData.transaction_no || qrData.cn || qrData.tx || ''
      const qrBoxId = qrData.bi || qrData.box_id || ''

      if (!transactionNo && !qrBoxId) {
        toast({ title: "Invalid QR", description: "QR code does not contain box data", variant: "destructive" })
        return
      }

      // Duplicate check
      const isDuplicate = articlesList.some(e => e.boxId === qrBoxId && e.transactionNo === transactionNo)
      if (isDuplicate) {
        toast({ title: "Duplicate Box", description: "This box has already been scanned", variant: "destructive" })
        return
      }

      let boxData = qrData

      // Fetch box details from backend based on QR format
      if (isNewQRFormat) {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/box-lookup-by-id/${company}?box_id=${encodeURIComponent(qrBoxId)}&transaction_no=${encodeURIComponent(transactionNo)}`
        const response = await fetch(apiUrl)
        if (response.ok) {
          const data = await response.json()
          boxData = { ...qrData, ...data.box }
        }
      } else if (isBulkEntryQR) {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/bulk-entry-box-lookup/${company}?box_id=${encodeURIComponent(qrBoxId)}&transaction_no=${encodeURIComponent(transactionNo)}`
        const response = await fetch(apiUrl)
        if (response.ok) {
          const data = await response.json()
          boxData = { ...qrData, ...data.box }
        }
      } else if (transactionNo.startsWith('TX') || transactionNo.startsWith('CONS')) {
        const boxNumber = qrData.box_number || qrData.bx || null
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/interunit/box-lookup/${company}?box_number=${encodeURIComponent(boxNumber || '')}&transaction_no=${encodeURIComponent(transactionNo)}`
        const response = await fetch(apiUrl)
        if (response.ok) {
          const data = await response.json()
          boxData = { ...qrData, ...data.box }
        }
      }

      const netWeight = parseFloat(boxData.net_weight || 0)
      const grossWeight = parseFloat(boxData.gross_weight || boxData.net_weight || 0)

      const entry: JobWorkEntry = {
        id: entryIdRef.current++,
        itemDescription: boxData.item_description || boxData.article_description || '',
        materialType: boxData.material_type || '',
        itemCategory: boxData.item_category || '',
        subCategory: boxData.sub_category || '',
        quantity: "1",
        uom: boxData.uom || "KG",
        packSize: String(boxData.packaging_type || 0),
        unitPackSize: String(boxData.unit_pack_size || 0),
        netWeight: String(netWeight),
        totalWeight: String(grossWeight > 0 ? grossWeight : netWeight),
        batchNumber: boxData.batch_number || "",
        lotNumber: boxData.lot_number || "",
        manufacturingDate: boxData.manufacturing_date || "",
        expiryDate: boxData.expiry_date || "",
        hsnSac: "08041020",
        gstRate: "0%",
        ratePerKg: "0",
        amount: "0",
        lineRemarks: "",
        boxId: boxData.box_id || qrBoxId || '',
        transactionNo: boxData.transaction_no || transactionNo || '',
      }

      setArticlesList(prev => [...prev, entry])
      toast({ title: "Box Scanned!", description: `${entry.itemDescription} | ${netWeight.toFixed(3)} kg` })

    } catch (error: any) {
      toast({ title: "Scan Error", description: error.message || "Could not process QR code", variant: "destructive" })
    } finally {
      isProcessingRef.current = false
    }
  }

  const handleQRScanError = (error: string) => {
    // Ignore common non-critical scan errors
  }

  // Form persistence (different key for edit mode)
  const { clearSavedData } = useFormPersistence(isEditMode ? `draft-jw-edit-${editId}` : "draft-job-work-out", {
    headerData: { value: headerData, setter: setHeaderData },
    transferInfo: { value: transferInfo, setter: setTransferInfo },
    articles: { value: articles, setter: setArticles },
    articlesList: { value: articlesList, setter: setArticlesList },
    challanNo: { value: challanNo, setter: setChallanNo },
  })

  // Load existing record for edit mode
  useEffect(() => {
    if (!editId) return
    const loadForEdit = async () => {
      setEditLoading(true)
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/job-work/out-by-id/${editId}`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error(`Failed to load record: ${res.status}`)
        const data = await res.json()

        // Set challan number
        setChallanNo(data.challan_no || "")

        // Set header data
        setHeaderData(prev => ({
          ...prev,
          jobWorkDate: data.job_work_date || currentDate,
          fromWarehouse: data.from_warehouse || "",
          toParty: data.to_party || "",
          partyAddress: data.party_address || "",
          remarks: data.remarks || "",
          e_way_bill_no: data.e_way_bill_no || "",
          dispatched_through: data.dispatched_through || "",
        }))

        // Set dispatch_to
        const dt = data.dispatch_to || {}
        setDispatchTo(prev => ({
          ...prev,
          name: dt.name || data.to_party || "",
          address: dt.address || data.party_address || "",
          state: dt.state || "Maharashtra",
          city: dt.city || "",
          pin_code: dt.pin_code || "",
          contact_company: dt.contact_company || "",
          contact_mobile: dt.contact_mobile || "",
          email: dt.email || "",
          sub_category: dt.sub_category || data.sub_category || "",
        }))

        // Set sub_category "other" check
        if (dt.sub_category && !subCatOptions.includes(dt.sub_category)) {
          setSubCatIsOther(true)
        }

        // Set transfer info
        setTransferInfo(prev => ({
          ...prev,
          vehicleNumber: data.vehicle_no || "",
          driverName: data.driver_name || "",
          authorizedPerson: data.authorized_person || "",
        }))

        // Load articles list from line items
        if (data.items && data.items.length > 0) {
          const entries: JobWorkEntry[] = data.items.map((item: any, idx: number) => ({
            id: Date.now() + idx,
            itemDescription: item.item_description || "",
            materialType: item.material_type || "",
            itemCategory: item.item_category || "",
            subCategory: item.sub_category || "",
            quantity: String(item.quantity_boxes || 0),
            uom: item.uom || "KG",
            packSize: String(item.case_pack || 0),
            unitPackSize: String(item.unit_pack_size || 0),
            netWeight: String(item.net_weight || 0),
            totalWeight: String(item.total_weight || 0),
            batchNumber: item.batch_number || "",
            lotNumber: item.lot_number || "",
            manufacturingDate: item.manufacturing_date || "",
            expiryDate: item.expiry_date || "",
            hsnSac: item.hsn_sac || "",
            gstRate: item.gst_rate || "",
            ratePerKg: String(item.rate_per_kg || 0),
            amount: String(item.amount || 0),
            lineRemarks: item.remarks || "",
            coldUnit: item.cold_unit || "",
            itemMark: item.item_mark || "",
            boxId: item.box_id || "",
            transactionNo: item.transaction_no || "",
          }))
          setArticlesList(entries)
        }

        toast({ title: "Record Loaded", description: `Editing challan ${data.challan_no}` })
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to load record for editing", variant: "destructive" })
      } finally {
        setEditLoading(false)
      }
    }
    loadForEdit()
  }, [editId])

  // ════════════════════════════════════════
  //  HANDLERS
  // ════════════════════════════════════════

  const handleHeaderChange = (field: string, value: string) => {
    setHeaderData(prev => ({ ...prev, [field]: value }))
  }

  const handleTransferInfoChange = (field: string, value: string) => {
    setTransferInfo(prev => ({ ...prev, [field]: value }))
  }

  const calculateNetWeight = (article: Article): number => {
    const qty = Number(article.quantity_units) || 1
    const packSize = Number(article.packaging_type) || 0
    if (article.material_type === 'FG') {
      const unitPackSize = Number(article.unit_pack_size) || 1
      return parseFloat(((unitPackSize * packSize) * qty).toFixed(3))
    }
    return parseFloat((qty * packSize).toFixed(2))
  }

  const updateArticle = (id: string, field: string, value: any) => {
    setArticles(prev => prev.map(art => {
      if (art.id !== id) return art
      const updated = { ...art, [field]: value }
      if (field === "material_type" && value !== art.material_type) {
        updated.item_category = ""; updated.sub_category = ""; updated.item_description = ""; updated.sku_id = null; updated.unit_pack_size = 0
      }
      if (field === "item_category" && value !== art.item_category) {
        updated.sub_category = ""; updated.item_description = ""; updated.sku_id = null
      }
      if (field === "sub_category" && value !== art.sub_category) {
        updated.item_description = ""; updated.sku_id = null
      }
      // For PM items, skip recalc when unit_pack_size changes (it doesn't affect net weight)
      const skipRecalc = field === "unit_pack_size" && updated.material_type === "PM"
      if (!skipRecalc && ["quantity_units", "packaging_type", "unit_pack_size", "material_type"].includes(field)) {
        // Don't recalculate net_weight for cold storage articles — it's per-box weight from stock
        if (updated.cs_max_boxes === null) {
          updated.net_weight = calculateNetWeight(updated)
        }
      }
      if (["quantity_units", "packaging_type", "unit_pack_size", "material_type", "rate_per_kg", "net_weight"].includes(field)) {
        updated.amount = parseFloat(((updated.net_weight || 0) * (updated.rate_per_kg || 0)).toFixed(2))
      }
      return updated
    }))
  }

  const addArticle = () => setArticles(prev => [...prev, emptyArticle()])

  const removeArticle = (id: string) => {
    if (articles.length > 1) setArticles(prev => prev.filter(a => a.id !== id))
    else toast({ title: "Cannot Remove", description: "At least one article entry is required.", variant: "destructive" })
  }

  // Quick search
  const handleItemSearch = (articleId: string, query: string) => {
    setItemSearchQuery(prev => ({ ...prev, [articleId]: query }))
    if (searchTimeoutRef.current[articleId]) clearTimeout(searchTimeoutRef.current[articleId])
    if (!query || query.trim().length < 2) {
      setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
      setItemSearchOpen(prev => ({ ...prev, [articleId]: false }))
      return
    }
    searchTimeoutRef.current[articleId] = setTimeout(async () => {
      setItemSearchLoading(prev => ({ ...prev, [articleId]: true }))
      try {
        const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/interunit/categorial-search?search=${encodeURIComponent(query.trim())}&limit=200`
        const res = await fetch(apiUrl, { headers: { 'Accept': 'application/json' } })
        if (!res.ok) throw new Error()
        const result = await res.json()
        setItemSearchResults(prev => ({ ...prev, [articleId]: result.items || [] }))
        setItemSearchOpen(prev => ({ ...prev, [articleId]: true }))
      } catch {
        setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
      } finally {
        setItemSearchLoading(prev => ({ ...prev, [articleId]: false }))
      }
    }, 300)
  }

  const handleItemSelect = (articleId: string, item: any) => {
    setArticles(prev => prev.map(art => {
      if (art.id !== articleId) return art
      const updated = {
        ...art,
        material_type: item.material_type || "",
        item_category: item.group ?? "",
        sub_category: item.sub_group ?? "",
        item_description: item.item_description || "",
        sku_id: item.id || null,
        unit_pack_size: item.uom != null ? item.uom : 0,
        net_weight: 0,
      }
      updated.net_weight = calculateNetWeight(updated)
      return updated
    }))
    setItemSearchQuery(prev => ({ ...prev, [articleId]: "" }))
    setItemSearchResults(prev => ({ ...prev, [articleId]: [] }))
    setItemSearchOpen(prev => ({ ...prev, [articleId]: false }))
    toast({ title: "Item Selected", description: `${item.item_description} selected` })
  }

  // Cold transfer summary popup
  const [popupCopied, setPopupCopied] = useState(false)
  const [coldTransferPopup, setColdTransferPopup] = useState<{ open: boolean; message: string }>({ open: false, message: "" })

  // Cold storage check
  const isColdStorageFrom = COLD_STORAGE_WAREHOUSES.includes(headerData.fromWarehouse)

  // Handle cold storage stock selection
  const handleSelectColdStorageStock = (articleId: string, record: ColdStorageStockRecord, coldCompany?: string) => {
    const coldUnitName = coldCompany === "cfpl" ? "Savla D-39" : coldCompany === "cdpl" ? "Rishi" : coldCompany || ""
    setArticles(prev => prev.map(article => {
      if (article.id !== articleId) return article
      const availableBoxes = record.net_qty_on_cartons ? Math.ceil(record.net_qty_on_cartons) : 0
      return {
        ...article,
        item_category: record.group_name || article.item_category,
        item_description: record.item_description || article.item_description,
        lot_number: record.lot_no ? String(record.lot_no) : article.lot_number,
        quantity_units: 0,
        unit_pack_size: 0,
        net_weight: record.weight_kg ?? 0,
        total_weight: 0,
        packaging_type: availableBoxes,
        cs_max_boxes: availableBoxes,
        cs_box_id: record.box_id || null,
        cs_transaction_no: record.transaction_no || null,
        cs_inward_no: record.inward_no || null,
        cold_company: coldUnitName,
        item_mark: record.item_mark || "",
      }
    }))
    toast({
      title: "Stock Selected",
      description: `Filled from stock: ${record.item_description || "N/A"} - Lot ${record.lot_no || "N/A"}`,
    })
  }

  // Add article to entries list
  const handleAddToList = async (article: Article) => {
    if (!article.item_description) {
      toast({ title: "Missing Fields", description: "Please fill item description before adding.", variant: "destructive" })
      return
    }
    const qty = article.quantity_units || 1

    // Cold storage stock limit validation
    if (article.cs_max_boxes !== null && qty > article.cs_max_boxes) {
      toast({ title: "Limit Exceeded", description: `No. of boxes (${qty}) exceeds available stock (${article.cs_max_boxes})`, variant: "destructive" })
      return
    }

    const isColdStorageArticle = article.cs_max_boxes !== null
    const netWeightPerBox = isColdStorageArticle ? (article.net_weight || 0) : (qty > 0 ? (article.net_weight || 0) / qty : 0)
    const totalWeightPerBox = isColdStorageArticle ? (article.net_weight || 0) : (qty > 0 ? ((article.total_weight > 0 ? article.total_weight : article.net_weight || 0) / qty) : 0)

    // For cold storage articles, pick individual box_ids in FIFO order from backend
    let pickedBoxes: { id: number; box_id: string; transaction_no: string; weight_kg: number; [key: string]: any }[] = []
    if (isColdStorageArticle && article.item_description && article.lot_number && article.cs_inward_no) {
      try {
        const pickResult = await ColdStorageApiService.pickBoxes({
          company,
          item_description: article.item_description,
          lot_no: article.lot_number,
          inward_no: article.cs_inward_no,
          qty,
        })
        pickedBoxes = pickResult.boxes
      } catch (err) {
        console.error("pickBoxes API Failed:", err)
      }
    }

    const newEntries: JobWorkEntry[] = []

    if (isColdStorageArticle) {
      // Create one entry per box for cold storage items
      for (let i = 0; i < qty; i++) {
        const pickedBox = pickedBoxes[i]
        const boxId = pickedBox?.box_id || article.cs_box_id || ''
        const transactionNo = pickedBox?.transaction_no || article.cs_transaction_no || ''
        const boxNetWeight = pickedBox ? pickedBox.weight_kg : netWeightPerBox
        const boxTotalWeight = pickedBox ? pickedBox.weight_kg : totalWeightPerBox

        // Build cold storage snapshot from picked box data for restore on delete
        const snapshot = pickedBox ? {
          inward_dt: pickedBox.inward_dt,
          unit: pickedBox.unit,
          inward_no: pickedBox.inward_no,
          item_description: pickedBox.item_description,
          item_mark: pickedBox.item_mark,
          vakkal: pickedBox.vakkal,
          lot_no: pickedBox.lot_no,
          no_of_cartons: pickedBox.no_of_cartons,
          weight_kg: pickedBox.weight_kg,
          total_inventory_kgs: pickedBox.total_inventory_kgs,
          group_name: pickedBox.group_name,
          storage_location: pickedBox.storage_location,
          exporter: pickedBox.exporter,
          last_purchase_rate: pickedBox.last_purchase_rate,
          value: pickedBox.value,
          box_id: pickedBox.box_id,
          transaction_no: pickedBox.transaction_no,
        } : null

        newEntries.push({
          id: entryIdRef.current++,
          itemDescription: article.item_description,
          materialType: article.material_type,
          itemCategory: article.item_category,
          subCategory: article.sub_category,
          quantity: "1",
          uom: article.uom || "KG",
          packSize: String(article.packaging_type || 0),
          unitPackSize: String(article.unit_pack_size || 0),
          netWeight: String(parseFloat(boxNetWeight.toFixed(3))),
          totalWeight: String(parseFloat(boxTotalWeight.toFixed(3))),
          batchNumber: article.batch_number || "",
          lotNumber: article.lot_number || "",
          manufacturingDate: article.manufacturing_date || "",
          expiryDate: article.expiry_date || "",
          hsnSac: article.hsn_sac || "08041020",
          gstRate: article.gst_rate || "0%",
          ratePerKg: String(article.rate_per_kg || 0),
          amount: String(parseFloat((boxNetWeight * (article.rate_per_kg || 0)).toFixed(2))),
          lineRemarks: article.line_remarks || "",
          coldUnit: article.cold_company || "",
          itemMark: pickedBox?.item_mark || article.item_mark || "",
          boxId,
          transactionNo,
          coldStockSnapshot: snapshot,
        })
      }
    } else {
      // Non-cold-storage: single entry with full quantity
      const netWt = article.net_weight || 0
      const totalWt = article.total_weight > 0 ? article.total_weight : netWt

      newEntries.push({
        id: entryIdRef.current++,
        itemDescription: article.item_description,
        materialType: article.material_type,
        itemCategory: article.item_category,
        subCategory: article.sub_category,
        quantity: String(qty),
        uom: article.uom || "KG",
        packSize: String(article.packaging_type || 0),
        unitPackSize: String(article.unit_pack_size || 0),
        netWeight: String(netWt),
        totalWeight: String(totalWt > 0 ? totalWt : netWt),
        batchNumber: article.batch_number || "",
        lotNumber: article.lot_number || "",
        manufacturingDate: article.manufacturing_date || "",
        expiryDate: article.expiry_date || "",
        hsnSac: article.hsn_sac || "08041020",
        gstRate: article.gst_rate || "0%",
        ratePerKg: String(article.rate_per_kg || 0),
        amount: String(article.amount || 0),
        lineRemarks: article.line_remarks || "",
        coldUnit: article.cold_company || "",
        itemMark: article.item_mark || "",
        boxId: "",
        transactionNo: "",
      })
    }

    setArticlesList(prev => [...prev, ...newEntries])
    toast({ title: "Added", description: `${newEntries.length} entr${newEntries.length > 1 ? 'ies' : 'y'} added for ${article.item_description}` })

    // Reset article
    setArticles(prev => prev.map(a => a.id === article.id ? emptyArticle() : a))
  }

  const removeFromList = (id: number) => {
    setArticlesList(prev => prev.filter(e => e.id !== id))
  }

  const updateListEntry = (id: number, field: string, value: string) => {
    setArticlesList(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  // ════════════════════════════════════════
  //  SUBMIT JOB WORK OUT
  // ════════════════════════════════════════

  const handleSubmitOut = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: string[] = []

    if (!headerData.fromWarehouse) errors.push("From Warehouse is required")
    if (!dispatchTo.name) errors.push("Dispatch To name is required")
    if (articlesList.length === 0) errors.push("At least one article must be added to the list")
    if (!transferInfo.vehicleNumber) errors.push("Vehicle number is required")

    if (errors.length > 0) {
      toast({ title: `Validation Error (${errors.length})`, description: errors.join(" • "), variant: "destructive" })
      return
    }

    setSubmitting(true)

    const clean = (v: any) => (v && v !== 'N/A') ? v : ""

    const vehicleNo = transferInfo.vehicleNumber
    const driverName = transferInfo.driverName === "other" ? transferInfo.driverNameOther : transferInfo.driverName

    const totalKgs = articlesList.reduce((s, e) => s + (parseFloat(e.netWeight) || 0), 0)
    const totalAmount = articlesList.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)

    const payload = {
      document_type: "MATERIAL OUT",
      company: {
        name: "CANDOR DATES PRIVATE LIMITED",
        address: "W-202A, MIDC, TTC INDUSTRIAL AREA, KHAIRNE, MIDC, NAVI MUMBAI, THANE 400710",
        fssai_no: "11522998001846",
        gstin: "27AAKCC3130A1Z9",
        state: "Maharashtra",
        state_code: "27",
        email: "accounts@candorfoods.in",
      },
      dispatch_to: dispatchTo,
      party: dispatchTo,
      challan_no: challanNo,
      e_way_bill_no: headerData.e_way_bill_no || null,
      dispatched_through: headerData.dispatched_through || null,
      dated: headerData.jobWorkDate,
      motor_vehicle_no: vehicleNo,
      header: {
        challan_no: challanNo,
        job_work_date: headerData.jobWorkDate,
        from_warehouse: headerData.fromWarehouse,
        to_party: headerData.toParty.trim(),
        party_address: headerData.partyAddress.trim(),
        contact_person: headerData.contactPerson.trim(),
        contact_number: headerData.contactNumber.trim(),
        purpose_of_work: headerData.purposeOfWork.trim(),
        expected_return_date: headerData.expectedReturnDate,
        vehicle_no: vehicleNo,
        driver_name: driverName,
        authorized_person: transferInfo.authorizedPerson.trim(),
        remarks: headerData.remarks.trim(),
        type: "OUT",
      },
      line_items: articlesList.map((entry, idx) => ({
        sl_no: idx + 1,
        description: clean(entry.itemDescription),
        hsn_sac: clean(entry.hsnSac) || "08041020",
        gst_rate: clean(entry.gstRate) || "0%",
        quantity: {
          kgs: parseFloat(entry.totalWeight) || parseFloat(entry.netWeight) || 0,
          boxes: parseInt(entry.quantity) || 0,
        },
        rate_per_kg: parseFloat(entry.ratePerKg) || 0,
        amount: parseFloat(entry.amount) || 0,
        remarks: clean(entry.lineRemarks),
        material_type: clean(entry.materialType),
        item_category: clean(entry.itemCategory),
        sub_category: clean(entry.subCategory),
        item_description: clean(entry.itemDescription),
        uom: clean(entry.uom),
        case_pack: entry.packSize,
        unit_pack_size: entry.unitPackSize,
        net_weight: entry.netWeight,
        total_weight: entry.totalWeight,
        batch_number: clean(entry.batchNumber),
        lot_number: clean(entry.lotNumber),
        manufacturing_date: clean(entry.manufacturingDate),
        expiry_date: clean(entry.expiryDate),
        box_id: entry.boxId || "",
        transaction_no: entry.transactionNo || "",
        cold_unit: entry.coldUnit || "",
        item_mark: entry.itemMark || "",
        cold_stock_snapshot: entry.coldStockSnapshot || null,
      })),
      totals: {
        total_quantity_kgs: totalKgs,
        total_amount: totalAmount,
        amount_in_words: "",
      },
      tax_summary: {
        hsn_sac: articlesList[0]?.hsnSac || "08041020",
        taxable_value: totalAmount,
        tax_amount: 0,
        tax_amount_in_words: "NIL",
      },
      remarks: headerData.remarks.trim(),
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'
      const apiUrl = isEditMode
        ? `${baseUrl}/job-work/out/${editId}?created_by=${encodeURIComponent(user?.email || '')}`
        : `${baseUrl}/job-work/out?created_by=${encodeURIComponent(user?.email || '')}`
      const res = await fetch(apiUrl, {
        method: isEditMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Submission failed: ${res.status}`)
      }

      toast({ title: isEditMode ? "Record Updated" : "Job Work Out Submitted", description: `Challan ${challanNo} ${isEditMode ? 'updated' : 'created'} successfully` })
      clearSavedData()

      // Save payload to sessionStorage for DC page
      try {
        sessionStorage.setItem(`jw-dc-${challanNo}`, JSON.stringify(payload))
      } catch { /* ignore storage errors */ }

      // If material out from cold storage — show unit-wise summary popup
      if (isColdStorageFrom) {
        const vehicleNo = transferInfo.vehicleNumber === "other" ? transferInfo.vehicleNumberOther : transferInfo.vehicleNumber
        // Group items by cold unit
        const unitGroups: Record<string, typeof articlesList> = {}
        articlesList.forEach((art) => {
          const unit = art.coldUnit || "Cold Storage"
          if (!unitGroups[unit]) unitGroups[unit] = []
          unitGroups[unit].push(art)
        })
        const sections: string[] = []
        Object.entries(unitGroups).forEach(([unit, items]) => {
          const header = `━━ ${unit} → ${headerData.toParty || "-"} ━━`
          // Consolidate items by itemMark + itemDescription + lotNumber
          const consolidated: Record<string, { itemMark: string; itemDescription: string; lotNumber: string; totalBoxes: number }> = {}
          items.forEach((art) => {
            const key = `${art.itemMark || "-"}||${art.itemDescription || "-"}||${art.lotNumber || "-"}`
            if (!consolidated[key]) {
              consolidated[key] = { itemMark: art.itemMark || "-", itemDescription: art.itemDescription || "-", lotNumber: art.lotNumber || "-", totalBoxes: 0 }
            }
            consolidated[key].totalBoxes += parseInt(art.quantity) || 1
          })
          const itemLines = Object.values(consolidated).map((c) =>
            `Item Mark : ${c.itemMark}\nItem : ${c.itemDescription}\nNo of Boxes : ${c.totalBoxes}\nLot Number : ${c.lotNumber}`
          )
          sections.push([header, ...itemLines].join("\n\n"))
        })
        sections.push(`Vehicle Number : ${vehicleNo || "-"}`)
        sections.push(`Challan No : ${challanNo}`)
        const message = sections.join("\n\n")
        setColdTransferPopup({ open: true, message })
      } else {
        // No cold storage — navigate to DC print page
        router.push(`/${company}/transfer/job-work/dc/${encodeURIComponent(challanNo)}`)
      }
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message || "Failed to submit job work.", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  // ════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-5 bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/${company}/transfer/job-work`)}
          className="h-9 w-9 p-0 bg-white border-gray-200 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Send className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
            {isEditMode ? "Edit Material Out" : "Material Out - Job Work"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isEditMode ? `Editing challan ${challanNo}` : "Create a challan for sending materials to 3rd party for processing"}
          </p>
        </div>
      </div>

      {/* Loading overlay for edit mode */}
      {editLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mr-3" />
          <span className="text-sm text-gray-500">Loading record for editing...</span>
        </div>
      )}

      {/* Material Out Form */}
      <form onSubmit={handleSubmitOut} className={`space-y-4 ${editLoading ? 'hidden' : ''}`}>

        {/* ─── Challan & Date ─── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Material Out - Challan Details</CardTitle>
            <p className="text-xs text-muted-foreground">Fill in challan information for material dispatch to 3rd party</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Challan No</Label>
                  <div className="flex gap-1.5">
                    <Input value={challanNo} onChange={(e) => setChallanNo(e.target.value)}
                      className="h-9 bg-white border-gray-200 font-semibold" placeholder="Enter challan no" />
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => setChallanNo(generateChallanNo())}
                      className="h-9 px-2.5 shrink-0 border-gray-200 hover:bg-gray-50"
                      title="Auto-generate challan number">
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Dated</Label>
                  <Input type="date"
                    value={headerData.jobWorkDate.split('-').reverse().join('-')}
                    onChange={(e) => {
                      const [y, m, d] = e.target.value.split('-')
                      handleHeaderChange('jobWorkDate', `${d}-${m}-${y}`)
                    }}
                    className="h-9 bg-white border-gray-200" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">From Warehouse *</Label>
                  <Select value={headerData.fromWarehouse} onValueChange={(v) => handleHeaderChange('fromWarehouse', v)}>
                    <SelectTrigger className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select warehouse" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W202">W202</SelectItem>
                      <SelectItem value="A185">A185</SelectItem>
                      <SelectItem value="A101">A101</SelectItem>
                      <SelectItem value="A68">A68</SelectItem>
                      <SelectItem value="F53">F53</SelectItem>
                      <SelectItem value="Cold storage">Cold storage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">E-Way Bill No</Label>
                  <Input value={headerData.e_way_bill_no} onChange={(e) => handleHeaderChange('e_way_bill_no', e.target.value)}
                    className="h-9 bg-white border-gray-200" placeholder="E-way bill number" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Dispatch To & Party Details ─── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-cyan-50 to-teal-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
              <User className="h-4 w-4 text-cyan-600" />
              Dispatch To
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dispatch To</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Name *</Label>
                  <Select value={dispatchTo.name} onValueChange={handleVendorSelect}>
                    <SelectTrigger className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select vendor" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorList.map(v => (
                        <SelectItem key={v.name} value={v.name}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-medium text-gray-600">Address</Label>
                  <Input value={dispatchTo.address} onChange={(e) => setDispatchTo(prev => ({ ...prev, address: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="Full address" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">State</Label>
                  <Input value={dispatchTo.state} onChange={(e) => setDispatchTo(prev => ({ ...prev, state: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="State" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">City (District)</Label>
                  <Input value={dispatchTo.city} onChange={(e) => setDispatchTo(prev => ({ ...prev, city: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="City / District" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">PIN Code</Label>
                  <Input value={dispatchTo.pin_code} onChange={(e) => setDispatchTo(prev => ({ ...prev, pin_code: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="PIN code" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Contact Details - Company</Label>
                  <Input value={dispatchTo.contact_company} onChange={(e) => setDispatchTo(prev => ({ ...prev, contact_company: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="Company name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Contact Mobile Nos.</Label>
                  <Input value={dispatchTo.contact_mobile} onChange={(e) => setDispatchTo(prev => ({ ...prev, contact_mobile: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="Mobile number(s)" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">E-mail</Label>
                  <Input type="email" value={dispatchTo.email} onChange={(e) => setDispatchTo(prev => ({ ...prev, email: e.target.value }))}
                    className="h-9 bg-white border-gray-200" placeholder="Email address" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Sub Category (details of item which is supplied)</Label>
                  <Select value={subCatIsOther ? "Other" : dispatchTo.sub_category} onValueChange={(v) => {
                    if (v === "Other") {
                      setSubCatIsOther(true)
                      setDispatchTo(prev => ({ ...prev, sub_category: "" }))
                    } else {
                      setSubCatIsOther(false)
                      setDispatchTo(prev => ({ ...prev, sub_category: v }))
                    }
                  }}>
                    <SelectTrigger className="h-9 bg-white border-gray-200">
                      <SelectValue placeholder="Select sub category" />
                    </SelectTrigger>
                    <SelectContent>
                      {subCatOptions.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {subCatIsOther && (
                    <Input value={dispatchTo.sub_category} onChange={(e) => setDispatchTo(prev => ({ ...prev, sub_category: e.target.value }))}
                      className="h-9 bg-white border-gray-200 mt-1.5" placeholder="Enter sub category" />
                  )}
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ─── Transport & Dispatch Details ─── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-violet-50 to-purple-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
              <Truck className="h-4 w-4 text-violet-600" />
              Transport & Dispatch Details
            </CardTitle>
            <p className="text-xs text-muted-foreground">Vehicle and dispatch details for material dispatch</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Motor Vehicle No *</Label>
                  <Input value={transferInfo.vehicleNumber} onChange={(e) => handleTransferInfoChange('vehicleNumber', e.target.value)}
                    className="h-9 bg-white border-gray-200" placeholder="Enter vehicle number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Dispatched Through</Label>
                  <Input value={headerData.dispatched_through} onChange={(e) => handleHeaderChange('dispatched_through', e.target.value)}
                    className="h-9 bg-white border-gray-200" placeholder="Transport company / mode" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Line Items ─── */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Plus className="h-3.5 w-3.5 text-violet-600" />
              </div>
              Article Management
            </h2>
            <Button type="button" onClick={addArticle} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white h-9 px-4 text-xs sm:text-sm">
              <Plus className="mr-2 h-3.5 w-3.5" /> Add Article
            </Button>
          </div>

          {articles.map((article) => (
            <div key={article.id} className="border rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Article Entry</h4>
                <div className="flex items-center gap-2">
                  {article.sku_id && <Badge variant="outline" className="text-xs">SKU: {article.sku_id}</Badge>}
                  {articles.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeArticle(article.id)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {isColdStorageFrom ? (
                <>
                  {/* Cold Storage Stock Search */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3">
                    <ColdStorageStockSearch
                      onSelect={(record, coldCo) => handleSelectColdStorageStock(article.id, record, coldCo)}
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
                      <Label className="text-xs">Weight per Box (kg)</Label>
                      <Input value={article.net_weight || ""} readOnly placeholder="Auto-filled" className="bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Weight (kgs)</Label>
                      <Input value={article.quantity_units && article.net_weight ? (article.quantity_units * article.net_weight).toFixed(2) : ""} readOnly placeholder="Auto-calculated" className="bg-muted" />
                    </div>
                  </div>

                  {/* Editable fields: No. of Boxes, UOM, Lot Number */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">No. of Boxes/Cartons *</Label>
                      <Input type="number" min="1" max={article.cs_max_boxes ?? undefined}
                        value={article.quantity_units || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0
                          if (article.cs_max_boxes !== null && val > article.cs_max_boxes) {
                            toast({ title: "Limit Exceeded", description: `Maximum available boxes: ${article.cs_max_boxes}`, variant: "destructive" })
                            updateArticle(article.id, "quantity_units", article.cs_max_boxes)
                          } else {
                            updateArticle(article.id, "quantity_units", val)
                          }
                        }}
                        placeholder="Enter count" />
                      {article.cs_max_boxes !== null && (
                        <p className="text-[10px] text-muted-foreground">Available: {article.cs_max_boxes} boxes</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UOM *</Label>
                      <Select value={article.uom} onValueChange={(v) => updateArticle(article.id, "uom", v)}>
                        <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="CARTON">CARTON</SelectItem>
                          <SelectItem value="BAG">BAG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lot Number *</Label>
                      <Input value={article.lot_number}
                        onChange={(e) => updateArticle(article.id, "lot_number", e.target.value)}
                        placeholder="Enter lot number" />
                    </div>
                  </div>

                  {/* Add to List Button */}
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button type="button" onClick={() => handleAddToList(article)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 px-5 text-xs sm:text-sm w-full sm:w-auto">
                      <Plus className="mr-2 h-3.5 w-3.5" /> Add to Articles List
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Quick Item Search */}
                  <div className="relative">
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">Quick Search Item</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Type item name to search..."
                        value={itemSearchQuery[article.id] || ""}
                        onChange={(e) => handleItemSearch(article.id, e.target.value)}
                        onFocus={() => {
                          if (itemSearchResults[article.id]?.length > 0) {
                            setItemSearchOpen(prev => ({ ...prev, [article.id]: true }))
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setItemSearchOpen(prev => ({ ...prev, [article.id]: false })), 200)
                        }}
                        className="pl-9 h-9 text-sm border-violet-200 focus:border-violet-400 focus:ring-violet-400"
                      />
                      {itemSearchLoading[article.id] && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="h-4 w-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {itemSearchOpen[article.id] && itemSearchResults[article.id]?.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {itemSearchResults[article.id].map((item: any, i: number) => (
                          <button key={`${item.id}-${i}`} type="button"
                            className="w-full text-left px-3 py-2.5 hover:bg-violet-50 border-b border-gray-50 last:border-b-0 transition-colors"
                            onMouseDown={(e) => { e.preventDefault(); handleItemSelect(article.id, item) }}>
                            <div className="text-sm font-medium text-gray-800">{item.item_description}</div>
                            <div className="flex gap-2 mt-0.5">
                              {item.material_type && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{item.material_type}</span>}
                              {item.group && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{item.group}</span>}
                              {item.sub_group && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{item.sub_group}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {itemSearchOpen[article.id] && itemSearchQuery[article.id]?.length >= 2 && !itemSearchLoading[article.id] && itemSearchResults[article.id]?.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-500 text-center">
                        No items found
                      </div>
                    )}
                  </div>

                  {/* Dropdown Selectors: Material Type, Item Category, Sub Category, Item Description */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Material Type *</Label>
                      <MaterialTypeDropdown value={article.material_type} onValueChange={(v) => updateArticle(article.id, "material_type", v)} company={company} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Item Category *</Label>
                      <ItemCategoryDropdown materialType={article.material_type} value={article.item_category}
                        onValueChange={(v) => updateArticle(article.id, "item_category", v)} company={company} disabled={!article.material_type} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Sub Category</Label>
                      <SubCategoryDropdown categoryId={article.item_category} value={article.sub_category}
                        onValueChange={(v) => updateArticle(article.id, "sub_category", v)} company={company} materialType={article.material_type} disabled={!article.item_category} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Item Description *</Label>
                      <ItemDescriptionDropdown articleId={article.id} categoryId={article.item_category}
                        subCategoryId={article.sub_category} materialType={article.material_type}
                        value={article.item_description} onValueChange={() => {}}
                        company={company} updateArticle={updateArticle} disabled={!article.item_category || !article.sub_category} />
                    </div>
                  </div>

                  {/* Quantity & Weight Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Unit Pack Size/Count</Label>
                      <Input type="number" step="any" min="0" value={article.unit_pack_size || ""}
                        onChange={(e) => updateArticle(article.id, "unit_pack_size", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()} placeholder="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">UOM</Label>
                      <Select value={article.uom} onValueChange={(v) => updateArticle(article.id, "uom", v)}>
                        <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOX">BOX</SelectItem>
                          <SelectItem value="BAG">BAG</SelectItem>
                          <SelectItem value="CARTON">CARTON</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Case Pack/Box Wt.</Label>
                      <Input type="number" step="any" min="0" value={article.packaging_type || ""}
                        onChange={(e) => updateArticle(article.id, "packaging_type", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()} placeholder="0.00" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity (Box/Bags)</Label>
                      <Input type="text" value={article.quantity_units || ""}
                        onChange={(e) => updateArticle(article.id, "quantity_units", Number(e.target.value) || 0)}
                        placeholder="0" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Net Weight (Kg)</Label>
                      <Input type="number" step="any" min="0" value={article.net_weight || ""}
                        onChange={(e) => updateArticle(article.id, "net_weight", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()} placeholder="Auto-calculated" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Total Wt (Kg) <span className="text-gray-400 font-normal">(Gross)</span></Label>
                      <Input type="number" step="any" min="0" value={article.total_weight || ""}
                        onChange={(e) => updateArticle(article.id, "total_weight", parseFloat(e.target.value) || 0)}
                        onWheel={(e) => e.currentTarget.blur()} placeholder="Enter gross weight" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lot Number <span className="text-gray-400 font-normal">(Optional)</span></Label>
                      <Input type="text" value={article.lot_number}
                        onChange={(e) => updateArticle(article.id, "lot_number", e.target.value)}
                        placeholder="Enter lot number" />
                    </div>
                  </div>

                  {/* Remarks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Item Remarks</Label>
                      <Input value={article.line_remarks} onChange={(e) => updateArticle(article.id, "line_remarks", e.target.value)}
                        placeholder="Remarks" />
                    </div>
                  </div>

                  {/* Add to List Button */}
                  <div className="flex justify-end pt-2 border-t border-gray-100">
                    <Button type="button" onClick={() => handleAddToList(article)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 sm:h-9 px-5 text-xs sm:text-sm w-full sm:w-auto">
                      <Plus className="mr-2 h-3.5 w-3.5" /> Add to Articles List
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ─── Scan QR / Manual Box Entry Section ─── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <CardTitle className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Scan QR Code / Enter Box Details
            </CardTitle>
            <p className="text-xs text-white/80">
              Scan boxes with camera or enter box details manually
            </p>
          </CardHeader>
          <CardContent className="p-3 sm:p-5">
            {/* QR Camera Scanner */}
            {!showScanner ? (
              <div className="py-4 sm:py-6 text-center">
                <Button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-6 w-full sm:w-auto"
                >
                  <Camera className="h-4 w-4 mr-2" /> Start Camera Scan
                </Button>
                <p className="text-xs text-gray-500 mt-3">
                  Uses native API for instant QR detection
                </p>
              </div>
            ) : (
              <div className="py-2 sm:py-4">
                <div className="w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
                  <HighPerformanceQRScanner
                    onScanSuccess={handleQRScanSuccess}
                    onScanError={handleQRScanError}
                    onClose={() => setShowScanner(false)}
                  />
                </div>
              </div>
            )}

            {/* OR Divider */}
            <div className="flex items-center gap-3 my-3 sm:my-4">
              <div className="flex-1 border-t border-gray-300" />
              <span className="text-xs font-semibold text-gray-500 uppercase">OR</span>
              <div className="flex-1 border-t border-gray-300" />
            </div>

            {/* Manual Box Entry */}
            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-600" />
                Manual Box Entry
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Box Number *</Label>
                  <Input
                    type="text"
                    placeholder="Enter Box Number"
                    value={manualBoxId}
                    onChange={(e) => setManualBoxId(e.target.value)}
                    className="h-9 bg-white border-gray-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        document.getElementById('jw-manual-txn-input')?.focus()
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-gray-600">Transaction No *</Label>
                  <Input
                    id="jw-manual-txn-input"
                    placeholder="Enter Transaction No"
                    value={manualTransactionNo}
                    onChange={(e) => setManualTransactionNo(e.target.value)}
                    className="h-9 bg-white border-gray-200"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleManualBoxFetch()
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleManualBoxFetch}
                  disabled={manualBoxLoading || !manualBoxId.trim() || !manualTransactionNo.trim()}
                  className="h-10 sm:h-9 px-5 bg-green-600 hover:bg-green-700 text-white text-sm w-full sm:w-auto"
                >
                  {manualBoxLoading ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Fetching...</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5 mr-1.5" /> Fetch Box</>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-gray-400 mt-2">
                Enter Box Number and Transaction No to fetch item details from inventory
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Added Items Table ─── */}
        {articlesList.length > 0 && (
          <Card className="border-0 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 border-b">
              <CardTitle className="text-sm sm:text-base font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-green-600" />
                Added Items ({articlesList.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">#</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Description</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Box ID</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Transaction No</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Qty</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Boxes</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Net Wt (Kg)</th>
                      <th className="px-3 py-2.5 text-right font-medium text-gray-600 text-xs">Total Wt (Kg)</th>
                      <th className="px-3 py-2.5 text-left font-medium text-gray-600 text-xs">Process</th>
                      <th className="px-3 py-2.5 text-center font-medium text-gray-600 text-xs">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {articlesList.map((entry, idx) => (
                      <tr key={entry.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-3 py-2 text-gray-500 text-xs">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-xs max-w-[200px] truncate">{entry.itemDescription}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-600 max-w-[100px] truncate" title={entry.boxId}>{entry.boxId || "-"}</td>
                        <td className="px-3 py-2 text-xs font-mono text-gray-600 max-w-[100px] truncate" title={entry.transactionNo}>{entry.transactionNo || "-"}</td>
                        <td className="px-3 py-2 text-right text-xs">{entry.quantity || "0"}</td>
                        <td className="px-3 py-2 text-right">
                          <Input type="number" value={entry.quantity} onChange={(e) => updateListEntry(entry.id, "quantity", e.target.value)}
                            className="h-7 w-16 text-xs text-right inline-block" />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Input type="number" value={entry.netWeight} onChange={(e) => updateListEntry(entry.id, "netWeight", e.target.value)}
                            className="h-7 w-20 text-xs text-right inline-block" step="0.001" />
                        </td>
                        <td className="px-3 py-2 text-right text-xs">{parseFloat(entry.totalWeight || "0").toFixed(3)}</td>
                        <td className="px-3 py-2 text-xs truncate max-w-[100px]">{dispatchTo.sub_category || "-"}</td>
                        <td className="px-3 py-2 text-center">
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFromList(entry.id)}
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t">
                    <tr>
                      <td colSpan={4} className="px-3 py-2 text-xs font-semibold text-gray-700">Total</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">{articlesList.reduce((s, e) => s + (Number(e.quantity) || 0), 0)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">{articlesList.reduce((s, e) => s + (Number(e.quantity) || 0), 0)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">{articlesList.reduce((s, e) => s + (parseFloat(e.netWeight) || 0), 0).toFixed(3)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold">{articlesList.reduce((s, e) => s + (parseFloat(e.totalWeight) || 0), 0).toFixed(3)}</td>
                      <td colSpan={2}></td>

                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Remarks ─── */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-slate-50 border-b">
            <CardTitle className="text-sm sm:text-base font-semibold text-gray-800">Remarks</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <Textarea value={headerData.remarks} onChange={(e) => handleHeaderChange('remarks', e.target.value)}
              className="bg-white border-gray-200 min-h-[80px]" placeholder="Any additional remarks or notes..." />
          </CardContent>
        </Card>

        {/* ─── Submit ─── */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/${company}/transfer/job-work`)}
            className="h-10 px-5 text-sm">Cancel</Button>
          <Button type="submit" disabled={submitting || articlesList.length === 0}
            className="h-10 px-6 text-sm bg-orange-600 hover:bg-orange-700 text-white shadow-sm">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</> :
              <><Send className="h-4 w-4 mr-2" />{isEditMode ? "Update Material Out" : "Submit Material Out"}</>}
          </Button>
        </div>
      </form>

      {/* Cold Transfer Summary Popup */}
      <Dialog open={coldTransferPopup.open} onOpenChange={() => {}}>
        <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Cold Storage - Material Out Summary</DialogTitle>
          </DialogHeader>
          <div className="relative bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap font-mono leading-relaxed">
            <button
              type="button"
              className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-gray-200 transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(coldTransferPopup.message)
                setPopupCopied(true)
                setTimeout(() => setPopupCopied(false), 2000)
              }}
            >
              {popupCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-500" />}
            </button>
            {coldTransferPopup.message}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setColdTransferPopup({ open: false, message: "" })
                router.push(`/${company}/transfer/job-work/dc/${encodeURIComponent(challanNo)}`)
              }}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
