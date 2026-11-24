import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NewDomainNotice, NEW_DOMAIN_URL } from './NewDomainNotice'

// Inward has a new home on erpcf.in; the old IMS screens stay usable, so this page
// only points people there — it must not swallow the way back.

describe('NewDomainNotice', () => {
  it('tells the user Inward has shifted to a new domain', () => {
    render(<NewDomainNotice company="cfpl" />)
    expect(screen.getByRole('heading', { name: /shifted to a new domain/i })).toBeInTheDocument()
  })

  it('sends the user to erpcf.in in the same tab', () => {
    render(<NewDomainNotice company="cfpl" />)
    const go = screen.getByRole('link', { name: /go to erpcf\.in/i })
    expect(NEW_DOMAIN_URL).toBe('https://erpcf.in')
    expect(go).toHaveAttribute('href', 'https://erpcf.in')
    expect(go).not.toHaveAttribute('target')
  })

  it('keeps a way back to the existing Inward entries for this company', () => {
    render(<NewDomainNotice company="cdpl" />)
    expect(screen.getByRole('link', { name: /back to inward entries/i })).toHaveAttribute('href', '/cdpl/inward')
  })
})
