"use client"

// QR dialog for a packing record: mints the AES-GCM batch token (authed),
// renders the QR encoding the public landing URL, and prints an isolated label.

import { useState } from "react"
import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Printer } from "lucide-react"
import { mintBatchToken } from "@/lib/packing"

const LANDING_BASE =
  process.env.NEXT_PUBLIC_QR_LANDING_URL || "https://www.candorfoods.in/packing-details"

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string),
  )
}

export function QrDialog({
  open,
  onOpenChange,
  batchCode,
  articleName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  batchCode: string
  articleName: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const { batch_token } = await mintBatchToken(batchCode)
      const sep = LANDING_BASE.includes("?") ? "&" : "?"
      setUrl(`${LANDING_BASE}${sep}t=${encodeURIComponent(batch_token)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate QR")
    } finally {
      setBusy(false)
    }
  }

  function printLabel() {
    if (!url) return
    const svg = document.querySelector("#packing-qr-svg svg")
    if (!svg) return
    const w = window.open("", "_blank", "width=460,height=620")
    if (!w) return
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Packing QR — ${escapeHtml(batchCode)}</title>` +
        `<style>*{margin:0;padding:0;box-sizing:border-box}` +
        `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:28px}` +
        `.qr{width:280px;height:280px;margin:0 auto}.qr svg{width:100%;height:100%}` +
        `.code{font-size:20px;font-weight:700;margin-top:16px;letter-spacing:.5px}` +
        `.art{font-size:13px;color:#444;margin-top:4px}.hint{font-size:10px;color:#999;margin-top:14px}` +
        `@media print{@page{margin:8mm}}</style></head><body>` +
        `<div class="qr">${svg.outerHTML}</div>` +
        `<div class="code">${escapeHtml(batchCode)}</div>` +
        `<div class="art">${escapeHtml(articleName)}</div>` +
        `<div class="hint">Scan to view packing details</div>` +
        `<script>window.onload=function(){window.focus();window.print();setTimeout(function(){window.close()},400)}<\/script>` +
        `</body></html>`,
    )
    w.document.close()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR label — {batchCode}</DialogTitle>
          <DialogDescription>
            Encodes the public scan URL with an encrypted batch token. Scanning opens the
            candorfoods.in page showing this batch&apos;s block details.
          </DialogDescription>
        </DialogHeader>

        {!url ? (
          <Button onClick={generate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Generate QR
          </Button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div id="packing-qr-svg" className="rounded border bg-white p-3">
              <QRCodeSVG value={url} size={180} level="M" />
            </div>
            <div className="text-center">
              <div className="text-base font-semibold">{batchCode}</div>
              <div className="text-xs text-muted-foreground">{articleName}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={printLabel}>
                <Printer className="h-4 w-4 mr-2" /> Print label
              </Button>
              <Button variant="outline" onClick={generate} disabled={busy}>
                Regenerate
              </Button>
            </div>
            <code className="text-[10px] text-muted-foreground break-all">{url}</code>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
