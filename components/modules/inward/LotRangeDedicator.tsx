"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tag, ChevronDown, ChevronUp, X, Plus } from "lucide-react"
import { isColdWarehouse } from "@/lib/constants/warehouses"

export interface LotRange {
  from: number
  to: number
  lot: string
}

interface LotRangeDedicatorProps {
  warehouse: string
  totalBoxes: number
  onApply: (ranges: LotRange[]) => void
}

export function LotRangeDedicator({ warehouse, totalBoxes, onApply }: LotRangeDedicatorProps) {
  const [expanded, setExpanded] = useState(false)
  const [ranges, setRanges] = useState<LotRange[]>([])
  const [fromInput, setFromInput] = useState("")
  const [toInput, setToInput] = useState("")
  const [lotInput, setLotInput] = useState("")
  const [addError, setAddError] = useState<string | null>(null)

  if (!isColdWarehouse(warehouse)) return null

  const validateAndAdd = () => {
    setAddError(null)
    const from = parseInt(fromInput)
    const to = parseInt(toInput)
    const lot = lotInput.trim()

    if (!lot) { setAddError("Lot number is required"); return }
    if (isNaN(from) || from < 1) { setAddError("From box must be ≥ 1"); return }
    if (isNaN(to) || to < from) { setAddError("To box must be ≥ From box"); return }
    if (totalBoxes > 0 && to > totalBoxes) { setAddError(`To box must be ≤ ${totalBoxes}`); return }

    const overlap = ranges.find(r => !(to < r.from || from > r.to))
    if (overlap) {
      setAddError(`Boxes ${overlap.from}–${overlap.to} are already assigned to Lot ${overlap.lot}. Remove that range first.`)
      return
    }

    setRanges(prev => [...prev, { from, to, lot }].sort((a, b) => a.from - b.from))
    setFromInput("")
    setToInput("")
    setLotInput("")
  }

  const removeRange = (idx: number) => {
    setRanges(prev => prev.filter((_, i) => i !== idx))
  }

  const handleApply = () => {
    onApply(ranges)
    setExpanded(false)
  }

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50"
        onClick={() => setExpanded(e => !e)}
      >
        <Tag className="h-3 w-3" />
        Assign Lot Numbers to Box Ranges
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {expanded && (
        <div className="mt-2 p-3 border border-amber-200 rounded-lg bg-amber-50/40 space-y-2">
          {ranges.length > 0 && (
            <div className="space-y-1">
              {ranges.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1">
                  <span className="text-muted-foreground">Boxes {r.from}–{r.to}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-medium">"{r.lot}"</span>
                  <button
                    type="button"
                    className="ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => removeRange(i)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 flex-wrap">
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">From Box</Label>
              <Input
                type="number"
                min="1"
                value={fromInput}
                onChange={(e) => { setFromInput(e.target.value); setAddError(null) }}
                placeholder="1"
                className="h-7 text-xs w-20"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">To Box</Label>
              <Input
                type="number"
                min="1"
                value={toInput}
                onChange={(e) => { setToInput(e.target.value); setAddError(null) }}
                placeholder={totalBoxes ? String(totalBoxes) : ""}
                className="h-7 text-xs w-20"
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground">Lot Number</Label>
              <Input
                value={lotInput}
                onChange={(e) => { setLotInput(e.target.value); setAddError(null) }}
                onKeyDown={(e) => e.key === "Enter" && validateAndAdd()}
                placeholder="e.g. 7648"
                className="h-7 text-xs w-28"
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={validateAndAdd}
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>

          {addError && (
            <p className="text-[11px] text-destructive">{addError}</p>
          )}

          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={ranges.length === 0}
            onClick={handleApply}
          >
            Apply to Boxes
          </Button>
        </div>
      )}
    </div>
  )
}
