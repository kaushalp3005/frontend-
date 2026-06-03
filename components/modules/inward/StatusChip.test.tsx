import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusChip } from './StatusChip'

// Item 3: shared chip so the L4 row and the peek-card hover render identical labels/tones.

describe('StatusChip', () => {
  it('renders "Stock Inward" for approved', () => {
    render(<StatusChip status="approved" />)
    expect(screen.getByText('Stock Inward')).toBeInTheDocument()
  })

  it('renders "Pending Approval" for pending', () => {
    render(<StatusChip status="pending" />)
    expect(screen.getByText('Pending Approval')).toBeInTheDocument()
  })

  it('applies the tone via data-tone for downstream styling/assertions', () => {
    render(<StatusChip status="approved" />)
    expect(screen.getByText('Stock Inward')).toHaveAttribute('data-tone', 'emerald')
  })

  it('forwards a custom className', () => {
    render(<StatusChip status="pending" className="ml-2" />)
    expect(screen.getByText('Pending Approval')).toHaveClass('ml-2')
  })
})
