import { describe, it, expect } from 'vitest'
import { inwardStatusMeta, inwardStatusSplit } from './status'

// Item 3: relabel raw inward status into the business terms the dashboard shows.
//   approved -> "Stock Inward" (emerald), pending -> "Pending Approval" (amber).
// One helper so the L4 row chip and the InwardPeekCard hover stay identical.

describe('inwardStatusMeta', () => {
  it('maps approved -> Stock Inward (emerald)', () => {
    const m = inwardStatusMeta('approved')
    expect(m.label).toBe('Stock Inward')
    expect(m.tone).toBe('emerald')
    expect(m.chipClass).toContain('emerald')
  })

  it('maps pending -> Pending Approval (amber)', () => {
    const m = inwardStatusMeta('pending')
    expect(m.label).toBe('Pending Approval')
    expect(m.tone).toBe('amber')
    expect(m.chipClass).toContain('amber')
  })

  it('is case-insensitive', () => {
    expect(inwardStatusMeta('APPROVED').label).toBe('Stock Inward')
    expect(inwardStatusMeta('Pending').label).toBe('Pending Approval')
  })

  it('falls back to a capitalized neutral chip for unknown statuses', () => {
    const m = inwardStatusMeta('draft')
    expect(m.label).toBe('Draft')
    expect(m.tone).toBe('slate')
  })

  it('handles empty / null as Unknown', () => {
    expect(inwardStatusMeta('').label).toBe('Unknown')
    expect(inwardStatusMeta(null).label).toBe('Unknown')
    expect(inwardStatusMeta(undefined).label).toBe('Unknown')
  })
})

describe('inwardStatusSplit', () => {
  const recs = [
    { transaction_no: 'T1', status: 'approved', net_weight: 100, total_weight: 110, total_amount: 1000 },
    { transaction_no: 'T1', status: 'approved', net_weight: 50, total_weight: 55, total_amount: 500 },
    { transaction_no: 'T2', status: 'pending', net_weight: 200, total_weight: 220, total_amount: 2000 },
  ]

  it('buckets ALL records and splits stock (approved) vs pending', () => {
    const s = inwardStatusSplit(recs)
    expect(s.all).toEqual({ count: 2, net: 350, gross: 385, value: 3500 })
    expect(s.pending).toEqual({ count: 1, net: 200, gross: 220, value: 2000 })
    expect(s.stock).toEqual({ count: 1, net: 150, gross: 165, value: 1500 })
  })

  it('reconciles: stock + pending === all (the headline is never reduced)', () => {
    const s = inwardStatusSplit(recs)
    expect(s.stock.count + s.pending.count).toBe(s.all.count)
    expect(s.stock.net + s.pending.net).toBe(s.all.net)
    expect(s.stock.gross + s.pending.gross).toBe(s.all.gross)
    expect(s.stock.value + s.pending.value).toBe(s.all.value)
  })

  it('treats any non-pending status (incl. unknown) as stock inward, case-insensitively', () => {
    const s = inwardStatusSplit([
      { transaction_no: 'A', status: 'APPROVED', net_weight: 10, total_weight: 11, total_amount: 1 },
      { transaction_no: 'B', status: 'Pending', net_weight: 20, total_weight: 22, total_amount: 2 },
    ])
    expect(s.stock.count).toBe(1)
    expect(s.pending.count).toBe(1)
  })

  it('returns zeroed buckets for no records', () => {
    const s = inwardStatusSplit([])
    expect(s.all).toEqual({ count: 0, net: 0, gross: 0, value: 0 })
    expect(s.pending).toEqual({ count: 0, net: 0, gross: 0, value: 0 })
    expect(s.stock).toEqual({ count: 0, net: 0, gross: 0, value: 0 })
  })
})
