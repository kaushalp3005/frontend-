"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Package, Plus, QrCode, Pencil, Trash2, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/stores/auth"
import {
  type PackingDetail, type Block,
  listPackingDetails, createPackingDetail, updatePackingDetail, deletePackingDetail,
  mintBatchToken, fetchByEncryptedBatch,
  blocksToDetails, blocksError, detailsToBlocks,
} from "@/lib/packing"
import { BlockEditor } from "./block-editor"
import { QrDialog } from "./qr-dialog"

function detailSummary(d: Record<string, unknown> | null | undefined): string {
  const keys = d && typeof d === "object" ? Object.keys(d) : []
  if (keys.length === 0) return "—"
  const preview = keys.slice(0, 3).join(", ")
  return keys.length > 3 ? `${keys.length} keys: ${preview}…` : `${keys.length} key${keys.length > 1 ? "s" : ""}: ${preview}`
}
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString()
}

export default function PackingDetailsPage() {
  const { accessToken } = useAuthStore()

  const [items, setItems] = useState<PackingDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [batchInput, setBatchInput] = useState("")
  const [articleInput, setArticleInput] = useState("")
  const [applied, setApplied] = useState<{ batch_code?: string; article_name?: string }>({})

  // create / edit dialog
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PackingDetail | null>(null)
  const [batchCode, setBatchCode] = useState("")
  const [articleName, setArticleName] = useState("")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<PackingDetail | null>(null)
  const [qrTarget, setQrTarget] = useState<PackingDetail | null>(null)

  const preview = useMemo(() => blocksToDetails(blocks), [blocks])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listPackingDetails({ ...applied, limit: 200 })
      setItems(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load packing details")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [applied])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setBatchCode("")
    setArticleName("")
    setBlocks([])
    setFormError(null)
    setFormOpen(true)
  }
  function openEdit(rec: PackingDetail) {
    setEditing(rec)
    setBatchCode(rec.batch_code)
    setArticleName(rec.article_name)
    setBlocks(detailsToBlocks(rec.details))
    setFormError(null)
    setFormOpen(true)
  }

  async function onSave() {
    setFormError(null)
    if (!batchCode.trim()) return setFormError("Batch code is required.")
    if (!articleName.trim()) return setFormError("Article name is required.")
    const be = blocksError(blocks)
    if (be) return setFormError(be)

    setSaving(true)
    try {
      const body = {
        batch_code: batchCode.trim(),
        article_name: articleName.trim(),
        details: blocksToDetails(blocks),
      }
      if (editing) {
        await updatePackingDetail(editing.id, body)
        toast.success("Packing detail updated")
      } else {
        await createPackingDetail(body)
        toast.success("Packing detail created")
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    try {
      await deletePackingDetail(id)
      setItems((prev) => prev.filter((p) => p.id !== id))
      toast.success("Packing detail deleted")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <div className="container mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Package className="h-5 w-5 sm:h-6 sm:w-6" /> Packing Details
          </h1>
          <p className="text-sm text-muted-foreground">
            Batch-level packing records with a free-form, block-built JSON body and printable QR labels.
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> New
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="f-batch" className="text-xs">Batch code</Label>
              <Input id="f-batch" value={batchInput} onChange={(e) => setBatchInput(e.target.value)}
                placeholder="e.g. B-001" className="w-[180px]" />
            </div>
            <div>
              <Label htmlFor="f-article" className="text-xs">Article name</Label>
              <Input id="f-article" value={articleInput} onChange={(e) => setArticleInput(e.target.value)}
                placeholder="e.g. Roasted Almonds" className="w-[220px]" />
            </div>
            <Button size="sm" variant="secondary"
              onClick={() => setApplied({ batch_code: batchInput.trim() || undefined, article_name: articleInput.trim() || undefined })}>
              Apply
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => { setBatchInput(""); setArticleInput(""); setApplied({}) }}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No packing details found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Created by</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.id}</TableCell>
                      <TableCell>{p.batch_code}</TableCell>
                      <TableCell>{p.article_name}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{detailSummary(p.details)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{p.created_by ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{fmtDate(p.created_at)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <Button variant="ghost" size="icon" title="QR label" onClick={() => setQrTarget(p)}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete"
                          className="text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EncryptedLookup />

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit packing detail #${editing.id}` : "New packing detail"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Batch code *</Label>
                <Input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="B-001" />
              </div>
              <div>
                <Label className="text-xs">Article name *</Label>
                <Input value={articleName} onChange={(e) => setArticleName(e.target.value)} placeholder="Roasted Almonds 200g" />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Details (blocks)</Label>
              <BlockEditor blocks={blocks} onChange={setBlocks} />
              <div className="mt-2">
                <span className="text-[11px] text-muted-foreground">Embedded JSON body</span>
                <pre className="mt-1 rounded border bg-muted/40 p-2 text-[11px] overflow-x-auto">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </div>
            </div>
            {formError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete packing detail #{deleteTarget?.id}?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR dialog */}
      {qrTarget && (
        <QrDialog
          open={!!qrTarget}
          onOpenChange={(o) => !o && setQrTarget(null)}
          batchCode={qrTarget.batch_code}
          articleName={qrTarget.article_name}
        />
      )}
    </div>
  )
}

// ── Encrypted batch lookup panel ────────────────────────────────────────────
function EncryptedLookup() {
  const [open, setOpen] = useState(false)
  const [batch, setBatch] = useState("")
  const [token, setToken] = useState("")
  const [results, setResults] = useState<PackingDetail[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function mint() {
    setBusy(true); setErr(null); setResults(null)
    try { const r = await mintBatchToken(batch.trim()); setToken(r.batch_token) }
    catch (e) { setErr(e instanceof Error ? e.message : "Mint failed") }
    finally { setBusy(false) }
  }
  async function fetchIt() {
    setBusy(true); setErr(null); setResults(null)
    try { setResults(await fetchByEncryptedBatch(token.trim())) }
    catch (e) { setErr(e instanceof Error ? e.message : "Fetch failed") }
    finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer py-3" onClick={() => setOpen((o) => !o)}>
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wide">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Encrypted batch lookup
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Mint an AES-256-GCM token for a batch, then fetch its records via the encrypted endpoint.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">Batch code</Label>
              <Input value={batch} onChange={(e) => setBatch(e.target.value)} placeholder="B-001" className="w-[200px]" />
            </div>
            <Button size="sm" variant="secondary" onClick={mint} disabled={busy || !batch.trim()}>Mint token</Button>
          </div>
          {token && (
            <div className="space-y-1">
              <Label className="text-xs">Batch token</Label>
              <div className="flex gap-2">
                <Input readOnly value={token} className="font-mono text-[11px]" onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(token)}>Copy</Button>
                <Button size="sm" onClick={fetchIt} disabled={busy}>Fetch</Button>
              </div>
            </div>
          )}
          {err && <p className="text-sm text-rose-600">{err}</p>}
          {results && (
            <div className="text-xs">
              <p className="text-muted-foreground mb-1">{results.length} record(s):</p>
              <pre className="rounded border bg-muted/40 p-2 text-[11px] overflow-x-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
