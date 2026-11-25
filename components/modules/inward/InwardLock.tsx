"use client"

import React, { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { NewDomainNotice } from "./NewDomainNotice"

interface InwardLockProps {
  company: string
  children: React.ReactNode
}

// Inward has moved to erpcf.in. Every inward screen still renders underneath — the
// logic is kept — but it is frozen behind the notice: `pointer-events-none` stops the
// mouse and `inert` stops keyboard focus, so nothing on it can be operated. The
// overlay sits under the sticky header (z-40) so the header menus keep working, and
// the sidebar is outside this wrapper, so other modules stay reachable.
export function InwardLock({ company, children }: InwardLockProps) {
  const pathname = usePathname()
  const lockedRef = useRef<HTMLDivElement>(null)

  // React 18 has no `inert` prop, so set the attribute directly.
  useEffect(() => {
    lockedRef.current?.setAttribute("inert", "")
  })

  // The notice page itself carries the same message; locking it would show it twice.
  if (pathname?.endsWith("/inward/new-domain")) return <>{children}</>

  return (
    <div className="relative min-h-[calc(100vh-7rem)]">
      <div
        ref={lockedRef}
        data-testid="inward-locked-content"
        aria-hidden="true"
        className="pointer-events-none select-none blur-[2px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 z-30 bg-background/60">
        <div className="sticky top-20 flex justify-center px-4 pt-10">
          <div className="w-full max-w-lg shadow-xl rounded-xl">
            <NewDomainNotice company={company} showBackLink={false} />
          </div>
        </div>
      </div>
    </div>
  )
}
