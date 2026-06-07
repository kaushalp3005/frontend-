"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Search, AlertCircle, ChevronDown, ChevronRight, Shield, ArrowRight, Loader2 } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth"

const API_URL = process.env.NEXT_PUBLIC_API_URL || ""

type Row = {
  table: string
  company: string | null
  lot: string | null
  box_id: string | null
  transaction_no: string | null
  item: string | null
  weight: number
  extra: Record<string, any>
}

type Category = {
  label: string
  count: number
  rows: Row[]
  truncated: boolean
}

type SearchResponse = {
  query: { lot_number: string | null; box_id: string | null; transaction_no: string | null }
  grand_total: number
  categories: Record<string, Category>
}

// Display order in the results panel. Transfer-Out → Transfer-In are paired
// (with the arrow rendered between them) so the "where did it go" story reads
// top-to-bottom.
const CATEGORY_ORDER = [
  "inward",
  "bulk_entry",
  "transfer_out",
  "transfer_in",
  "cold_transfer_in",
  "cold_stocks",
  "job_work_out",
  "job_work_in",
  "direct_out_disposition",
  "direct_out_header",
]

function formatExtra(row: Row): string {
  const e = row.extra || {}
  const bits: string[] = []
  if (e.from_site) bits.push(`from: ${e.from_site}`)
  if (e.to_site) bits.push(`to: ${e.to_site}`)
  if (e.receiving_warehouse) bits.push(`recv: ${e.receiving_warehouse}`)
  if (e.inward_warehouse) bits.push(`wh: ${e.inward_warehouse}`)
  if (e.canonical_warehouse) bits.push(`wh: ${e.canonical_warehouse}`)
  if (e.unit) bits.push(`unit: ${e.unit}`)
  if (e.storage_location && e.storage_location !== e.unit) bits.push(`loc: ${e.storage_location}`)
  if (e.status) bits.push(`status: ${e.status}`)
  if (e.disposition_type) bits.push(`type: ${e.disposition_type}`)
  if (e.disposition_ref_no) bits.push(`ref: ${e.disposition_ref_no}`)
  if (e.reverted) bits.push(`REVERTED`)
  if (e.challan_no) bits.push(`chln: ${e.challan_no}`)
  if (e.grn_number) bits.push(`grn: ${e.grn_number}`)
  if (e.transfer_out_no) bits.push(`from-out: ${e.transfer_out_no}`)
  if (e.to_customer) bits.push(`customer: ${e.to_customer}`)
  if (e.invoice_no) bits.push(`inv: ${e.invoice_no}`)
  if (e.vehicle_no) bits.push(`vehicle: ${e.vehicle_no}`)
  return bits.join(" · ")
}

function CategoryCard({ catKey, cat }: { catKey: string; cat: Category }) {
  const [open, setOpen] = useState(cat.count > 0 && cat.count <= 5)
  if (cat.count === 0) return null
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="flex flex-row items-center justify-between py-3 cursor-pointer hover:bg-muted/40">
            <div className="flex items-center gap-2 text-left">
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <CardTitle className="text-sm font-semibold">{cat.label}</CardTitle>
              <Badge variant="secondary" className="text-xs">{cat.count}{cat.truncated ? "+" : ""}</Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {cat.rows.map((row, idx) => (
                <div key={`${catKey}-${idx}`} className="border rounded p-2 text-xs space-y-1 bg-muted/20">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <code className="text-[11px] bg-background px-1 py-0.5 rounded border">{row.table}</code>
                    {row.company && <Badge variant="outline" className="text-[10px]">{row.company}</Badge>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1">
                    {row.lot && <div><span className="text-muted-foreground">lot:</span> <span className="font-mono">{row.lot}</span></div>}
                    {row.box_id && <div><span className="text-muted-foreground">box:</span> <span className="font-mono">{row.box_id}</span></div>}
                    {row.transaction_no && <div className="col-span-2"><span className="text-muted-foreground">txn:</span> <span className="font-mono">{row.transaction_no}</span></div>}
                    {row.item && <div className="col-span-2 sm:col-span-4"><span className="text-muted-foreground">item:</span> {row.item}</div>}
                    {row.weight > 0 && <div><span className="text-muted-foreground">wt:</span> {row.weight} kg</div>}
                  </div>
                  {formatExtra(row) && (
                    <div className="text-[11px] text-muted-foreground">{formatExtra(row)}</div>
                  )}
                </div>
              ))}
              {cat.truncated && (
                <p className="text-[11px] text-muted-foreground italic">
                  Showing first {cat.rows.length} — refine the query (add a transaction_no or box_id) to narrow.
                </p>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

export default function LotSearchPage() {
  const { user, accessToken, hasPermission } = useAuthStore()
  const allowed = hasPermission("lot-search", "view")

  const [lot, setLot] = useState("")
  const [box, setBox] = useState("")
  const [txn, setTxn] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SearchResponse | null>(null)

  const canSearch = useMemo(() => Boolean((lot || box || txn).trim()) && !loading, [lot, box, txn, loading])

  const runSearch = async () => {
    if (!canSearch) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const qs = new URLSearchParams()
      if (lot.trim()) qs.set("lot_number", lot.trim())
      if (box.trim()) qs.set("box_id", box.trim())
      if (txn.trim()) qs.set("transaction_no", txn.trim())

      const resp = await fetch(`${API_URL}/lot-search?${qs.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-User-Email": user?.email || "",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
      })
      if (!resp.ok) {
        let detail = `HTTP ${resp.status}`
        try {
          const body = await resp.json()
          if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail)
        } catch {}
        throw new Error(detail)
      }
      const data: SearchResponse = await resp.json()
      setResult(data)
    } catch (e: any) {
      setError(e?.message || "Search failed")
    } finally {
      setLoading(false)
    }
  }

  const clearAll = () => {
    setLot(""); setBox(""); setTxn("")
    setResult(null); setError(null)
  }

  if (!allowed) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Lot Search is restricted to authorized users.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-5 w-5 sm:h-6 sm:w-6" /> Lot Search
        </h1>
        <p className="text-sm text-muted-foreground">
          Lookup a lot / box / transaction across Inward, Transfer, Job Work, Direct Out and Cold Stocks.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="lot" className="text-xs">Lot Number</Label>
              <Input
                id="lot"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="e.g. 125860"
                onKeyDown={(e) => { if (e.key === "Enter") runSearch() }}
              />
            </div>
            <div>
              <Label htmlFor="box" className="text-xs">Box ID</Label>
              <Input
                id="box"
                value={box}
                onChange={(e) => setBox(e.target.value)}
                placeholder="e.g. BX-...."
                onKeyDown={(e) => { if (e.key === "Enter") runSearch() }}
              />
            </div>
            <div>
              <Label htmlFor="txn" className="text-xs">Transaction No</Label>
              <Input
                id="txn"
                value={txn}
                onChange={(e) => setTxn(e.target.value)}
                placeholder="e.g. TR-... / DO-..."
                onKeyDown={(e) => { if (e.key === "Enter") runSearch() }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={runSearch} disabled={!canSearch} size="sm">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1" />}
              Search
            </Button>
            <Button variant="outline" onClick={clearAll} size="sm" disabled={loading}>
              Clear
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              Tip — fill any 1 field. Filling more narrows results (AND).
            </span>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              {result.grand_total} row(s) across tables
            </Badge>
            {result.grand_total === 0 && (
              <span className="text-xs text-muted-foreground">No matches in any table.</span>
            )}
          </div>

          {CATEGORY_ORDER.map((key) => {
            const cat = result.categories[key]
            if (!cat) return null

            // Render the arrow between transfer_out → transfer_in to show the journey
            const isTransferIn = key === "transfer_in"
            const transferOut = result.categories["transfer_out"]
            const showArrow = isTransferIn && transferOut && transferOut.count > 0 && cat.count > 0

            return (
              <div key={key} className="space-y-2">
                {showArrow && (
                  <div className="flex justify-center text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                )}
                <CategoryCard catKey={key} cat={cat} />
              </div>
            )
          })}

          {Object.keys(result.categories).filter(k => !CATEGORY_ORDER.includes(k)).map((key) => (
            <CategoryCard key={key} catKey={key} cat={result.categories[key]} />
          ))}
        </div>
      )}
    </div>
  )
}
