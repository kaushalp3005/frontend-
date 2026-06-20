import QRCode from "qrcode"

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ))
}

export interface PrintLabelBox {
  box_id?: string
  box_number: number
  article_description: string
  net_weight?: string
  gross_weight?: string
  count?: string
  lot_number?: string
  item_mark?: string
}

/** Batch-print 4in x 2in QR labels for the given boxes via a hidden iframe. */
export async function printLabels(opts: {
  company: string
  rtvStringId: string
  customer?: string
  boxes: PrintLabelBox[]
}): Promise<void> {
  const { company, rtvStringId, customer = "", boxes } = opts
  if (!boxes.length) return
  const qrCodes = await Promise.all(
    boxes.map((b) =>
      QRCode.toDataURL(JSON.stringify({ rtv: rtvStringId, bi: b.box_id || `${b.box_number}` }), {
        width: 170, margin: 1, errorCorrectionLevel: "M",
      }),
    ),
  )
  const labels = boxes
    .map(
      (b, i) => `
    <div class="label">
      <div class="qr"><img src="${qrCodes[i]}" /></div>
      <div class="info">
        <div><div class="company">${escapeHtml(company)}</div><div class="txn">${escapeHtml(rtvStringId)}</div><div class="boxid">ID: ${escapeHtml(b.box_id || "—")}</div></div>
        <div class="item">${escapeHtml(b.article_description)}</div>
        <div>
          <div class="detail"><b>Box #${escapeHtml(b.box_number)}</b> &nbsp; Net: ${escapeHtml(b.net_weight || "—")}kg &nbsp; Gross: ${escapeHtml(b.gross_weight || "—")}kg</div>
          ${b.count ? `<div class="detail">Count: ${escapeHtml(b.count)}</div>` : ""}
        </div>
        <div class="lot">${escapeHtml([b.lot_number, b.item_mark].filter(Boolean).join(" · "))}</div>
      </div>
    </div>`,
    )
    .join("")
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:0;height:0"
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc) return
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><title>Labels</title><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size: 4in 2in; margin: 0; }
    .label { width:4in; height:2in; background:#fff; border:1px solid #000; display:flex; font-family:Arial, sans-serif; page-break-after:always; }
    .qr { width:2in; height:2in; display:flex; align-items:center; justify-content:center; padding:0.1in; }
    .qr img { width:1.7in; height:1.7in; }
    .info { width:2in; height:2in; padding:0.08in; font-size:8pt; line-height:1.2; display:flex; flex-direction:column; justify-content:space-between; }
    .company { font-weight:bold; font-size:9pt; } .txn { font-family:monospace; font-size:7pt; }
    .boxid { font-family:monospace; font-size:6.5pt; color:#555; }
    .item { font-weight:bold; font-size:7.5pt; } .detail { font-size:7pt; }
    .lot { font-family:monospace; border-top:1px solid #ccc; padding-top:2px; font-size:6.5pt; }
  </style></head><body>${labels}
    <script>window.onload=function(){setTimeout(function(){window.print();window.onafterprint=function(){window.parent.postMessage('print-complete','*')}},300)}</script>
  </body></html>`)
  doc.close()
  const cleanup = (e: MessageEvent) => {
    if (e.data === "print-complete") {
      window.removeEventListener("message", cleanup)
      if (document.body.contains(iframe)) document.body.removeChild(iframe)
    }
  }
  window.addEventListener("message", cleanup)
  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe)
      window.removeEventListener("message", cleanup)
    }
  }, 30000)
}
