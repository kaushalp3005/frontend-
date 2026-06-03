import { describe, it, expect } from 'vitest'
import { computeArticleAggregatesFromBoxes } from './aggregates'

// Item 1C: a single, tested formula for recomputing an article's display aggregates from its
// boxes. The approve and new-entry screens both hand-rolled this identically; this pins the
// behaviour (box count, summed net/gross, blank when zero) so the screens stay consistent.

describe('computeArticleAggregatesFromBoxes', () => {
  it('counts boxes and sums net/gross weights for the matching article', () => {
    const boxes = [
      { article_description: 'Onion', net_weight: '10', gross_weight: '12' },
      { article_description: 'Onion', net_weight: '20', gross_weight: '22' },
      { article_description: 'Onion', net_weight: '30', gross_weight: '32' },
    ]
    expect(computeArticleAggregatesFromBoxes(boxes, 'Onion')).toEqual({
      quantity_units: '3',
      net_weight: '60',
      total_weight: '66',
    })
  })

  it('only aggregates boxes belonging to the requested article', () => {
    const boxes = [
      { article_description: 'Onion', net_weight: '10', gross_weight: '12' },
      { article_description: 'Garlic', net_weight: '99', gross_weight: '99' },
    ]
    expect(computeArticleAggregatesFromBoxes(boxes, 'Onion')).toEqual({
      quantity_units: '1',
      net_weight: '10',
      total_weight: '12',
    })
  })

  it('rounds summed weights to 3 decimals', () => {
    const boxes = [
      { article_description: 'A', net_weight: '6.6005', gross_weight: '6.9' },
      { article_description: 'A', net_weight: '6.6005', gross_weight: '6.9' },
    ]
    // 6.6005 + 6.6005 = 13.201 -> "13.201"; gross 13.8
    const out = computeArticleAggregatesFromBoxes(boxes, 'A')
    expect(out.quantity_units).toBe('2')
    expect(out.net_weight).toBe('13.201')
    expect(out.total_weight).toBe('13.8')
  })

  it('returns blank weights (not "0") when there are no weights, count still reflects boxes', () => {
    const boxes = [
      { article_description: 'A', net_weight: '', gross_weight: '' },
      { article_description: 'A' },
    ]
    expect(computeArticleAggregatesFromBoxes(boxes, 'A')).toEqual({
      quantity_units: '2',
      net_weight: '',
      total_weight: '',
    })
  })

  it('returns 0 count and blank weights when no boxes match', () => {
    expect(computeArticleAggregatesFromBoxes([], 'A')).toEqual({
      quantity_units: '0',
      net_weight: '',
      total_weight: '',
    })
  })

  it('accepts numeric weights as well as strings', () => {
    const boxes = [
      { article_description: 'A', net_weight: 5, gross_weight: 6 },
      { article_description: 'A', net_weight: 5, gross_weight: 6 },
    ]
    expect(computeArticleAggregatesFromBoxes(boxes, 'A')).toEqual({
      quantity_units: '2',
      net_weight: '10',
      total_weight: '12',
    })
  })
})
