import { describe, it, expect } from 'vitest'
import { boxLabelQrPayload } from './qr'

// Item 2: bulk print must encode the SAME payload as a single-box print so downstream scanners
// (transfer / outward / GRN) are untouched. This pins the exact shape: {"tx":...,"bi":...}.

describe('boxLabelQrPayload', () => {
  it('encodes the transaction and box id as { tx, bi }', () => {
    expect(boxLabelQrPayload('INW-1000', '12345678-7')).toBe('{"tx":"INW-1000","bi":"12345678-7"}')
  })

  it('round-trips back to the tx/bi the scanners expect', () => {
    const parsed = JSON.parse(boxLabelQrPayload('TX-9', 'B-1'))
    expect(parsed).toEqual({ tx: 'TX-9', bi: 'B-1' })
  })
})
