"use client"

import React, { useRef, useCallback, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Box, Plus, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BoxNavItem {
  box_number: number
  lot_number?: string
  article_description?: string
}

interface BoxScrollContainerProps {
  boxCount: number
  onAddBox?: () => void
  onBulkAdd?: () => void
  boxForms?: BoxNavItem[]
  children: (registerRef: (boxNumber: number, el: HTMLElement | null) => void) => React.ReactNode
  className?: string
  // Pagination props (optional — only needed when totalPages > 1)
  currentPage?: number
  totalPages?: number
  onPageChange?: (page: number) => void
  // Called when search target is not on the current page (cross-page navigation)
  onNavigate?: (boxNumber: number) => void
  // Box to highlight after a cross-page navigation (scroll + amber border)
  highlightBox?: { boxNumber: number; key: number } | null
}

export function BoxScrollContainer({
  boxCount,
  onAddBox,
  onBulkAdd,
  boxForms = [],
  children,
  className,
  currentPage,
  totalPages,
  onPageChange,
  onNavigate,
  highlightBox,
}: BoxScrollContainerProps) {
  const refsMap = useRef<Map<number, HTMLElement>>(new Map())
  const [query, setQuery] = useState("")
  const [notFound, setNotFound] = useState(false)

  const registerRef = useCallback((boxNumber: number, el: HTMLElement | null) => {
    if (el) refsMap.current.set(boxNumber, el)
    else refsMap.current.delete(boxNumber)
  }, [])

  // Highlight a box after cross-page navigation (amber shade + amber border, distinct from Go yellow glow)
  useEffect(() => {
    if (!highlightBox) return
    const { boxNumber } = highlightBox

    const tryHighlight = (attempts: number) => {
      const el = refsMap.current.get(boxNumber)
      if (el) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" })
        el.style.transition = "background-color 0.3s, outline 0.3s"
        el.style.backgroundColor = "rgba(251, 191, 36, 0.28)"
        el.style.outline = "2px solid rgb(180, 83, 9)"
        el.style.borderRadius = "4px"
        setTimeout(() => {
          el.style.backgroundColor = ""
          el.style.outline = ""
          el.style.borderRadius = ""
        }, 2200)
      } else if (attempts > 0) {
        setTimeout(() => tryHighlight(attempts - 1), 80)
      }
    }

    setTimeout(() => tryHighlight(5), 60)
  }, [highlightBox])

  const goTo = useCallback(
    (q: string) => {
      const trimmed = q.trim()
      if (!trimmed) return

      let targetBoxNumber: number | null = null
      const asNumber = parseInt(trimmed)

      if (!isNaN(asNumber)) {
        if (refsMap.current.has(asNumber)) {
          targetBoxNumber = asNumber
        } else {
          // Box exists in forms but is on a different page
          const existsInForms = boxForms.some((b) => b.box_number === asNumber)
          if (existsInForms && onNavigate) {
            onNavigate(asNumber)
            setNotFound(false)
            return
          }
        }
      } else {
        const match = boxForms.find(
          (b) => b.lot_number && b.lot_number.toLowerCase().includes(trimmed.toLowerCase())
        )
        if (match) {
          if (refsMap.current.has(match.box_number)) {
            targetBoxNumber = match.box_number
          } else if (onNavigate) {
            // Lot found, but box is on a different page
            onNavigate(match.box_number)
            setNotFound(false)
            return
          }
        }
      }

      if (targetBoxNumber === null || !refsMap.current.has(targetBoxNumber)) {
        setNotFound(true)
        setTimeout(() => setNotFound(false), 2000)
        return
      }

      const el = refsMap.current.get(targetBoxNumber)!
      el.scrollIntoView({ block: "nearest", behavior: "smooth" })

      el.style.transition = "box-shadow 0.15s"
      el.style.boxShadow = "0 0 0 3px rgba(234, 179, 8, 0.7)"
      setTimeout(() => { el.style.boxShadow = "" }, 1200)

      const firstInput = el.querySelector(
        "input:not([readonly]):not([disabled])"
      ) as HTMLInputElement | null
      if (firstInput) setTimeout(() => firstInput.focus(), 120)

      setNotFound(false)
    },
    [boxForms, onNavigate]
  )

  const hasPagination = totalPages !== undefined && totalPages > 1 && onPageChange !== undefined

  return (
    <div className={cn("mt-2 pt-2 border-t", className)}>
      {/* Header bar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 flex-shrink-0">
          <Box className="h-3 w-3" />
          Boxes ({boxCount})
        </p>
        {/* Go-to input */}
        <div className="flex items-center gap-1">
          <Input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setNotFound(false) }}
            onKeyDown={(e) => e.key === "Enter" && goTo(query)}
            placeholder="Box # or lot #"
            className={cn("h-7 text-xs w-32", notFound && "border-destructive")}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2 flex-shrink-0"
            onClick={() => goTo(query)}
          >
            Go
          </Button>
          {notFound && (
            <span className="text-[11px] text-destructive">Not found</span>
          )}
        </div>

        {/* Pagination controls */}
        {hasPagination && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onPageChange!(1)}
              disabled={currentPage === 1}
              title="First page"
            >
              <ChevronsLeft className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onPageChange!(currentPage! - 1)}
              disabled={currentPage === 1}
              title="Previous page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-[11px] text-muted-foreground px-1 whitespace-nowrap">
              {currentPage}/{totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onPageChange!(currentPage! + 1)}
              disabled={currentPage === totalPages}
              title="Next page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onPageChange!(totalPages!)}
              disabled={currentPage === totalPages}
              title="Last page"
            >
              <ChevronsRight className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
          {onAddBox && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={onAddBox}
            >
              <Plus className="h-3 w-3" /> Add Box
            </Button>
          )}
          {onBulkAdd && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={onBulkAdd}
            >
              <Plus className="h-3 w-3" /> Bulk Add
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable box list */}
      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "8px",
          border: "1px solid #e2e8f0",
          borderRadius: "6px",
          background: "rgba(0,0,0,0.02)",
        }}
      >
        {children(registerRef)}
      </div>
    </div>
  )
}
