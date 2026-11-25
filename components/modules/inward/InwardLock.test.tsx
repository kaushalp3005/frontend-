import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InwardLock } from './InwardLock'

// Inward has moved to erpcf.in. Its screens still load (the logic stays), but they sit
// under a notice and must not be operable — by mouse or by keyboard.

let pathname = '/cfpl/inward'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

beforeEach(() => {
  pathname = '/cfpl/inward'
})

describe('InwardLock', () => {
  it('still renders the inward page underneath', () => {
    render(<InwardLock company="cfpl"><button>New Entry</button></InwardLock>)
    expect(screen.getByText('New Entry')).toBeInTheDocument()
  })

  it('makes the page underneath unusable by mouse and keyboard', () => {
    render(<InwardLock company="cfpl"><button>New Entry</button></InwardLock>)
    const locked = screen.getByTestId('inward-locked-content')
    expect(locked).toHaveAttribute('inert')
    expect(locked).toHaveAttribute('aria-hidden', 'true')
    expect(locked).toHaveClass('pointer-events-none')
    expect(locked).toContainElement(screen.getByText('New Entry'))
  })

  it('shows the shifted-to-new-domain notice on top, with no way back into the locked page', () => {
    render(<InwardLock company="cfpl"><div /></InwardLock>)
    expect(screen.getByRole('heading', { name: /shifted to a new domain/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to erpcf\.in/i })).toHaveAttribute('href', 'https://erpcf.in')
    expect(screen.queryByRole('link', { name: /back to inward entries/i })).not.toBeInTheDocument()
  })

  it('locks every inward route, not just the list', () => {
    for (const p of ['/cfpl/inward/new', '/cdpl/inward/bulk-sticker', '/cfpl/inward/TR-1/approve']) {
      pathname = p
      const { unmount } = render(<InwardLock company="cfpl"><div /></InwardLock>)
      expect(screen.getByTestId('inward-locked-content')).toHaveAttribute('inert')
      unmount()
    }
  })

  it('leaves the new-domain page itself unlocked', () => {
    pathname = '/cfpl/inward/new-domain'
    render(<InwardLock company="cfpl"><p>notice page</p></InwardLock>)
    expect(screen.getByText('notice page')).toBeInTheDocument()
    expect(screen.queryByTestId('inward-locked-content')).not.toBeInTheDocument()
  })
})
