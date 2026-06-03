// Canonical QR payload for a box label. Downstream scanners (transfer, outward, GRN) decode this
// exact shape, so every print path — single-box and bulk — MUST emit it identically. Centralising
// it here makes that invariant testable and impossible to drift per screen. Do not change the keys
// (`tx`, `bi`) without updating every scanner.
export function boxLabelQrPayload(transactionNo: string, boxId: string): string {
  return JSON.stringify({ tx: transactionNo, bi: boxId })
}
