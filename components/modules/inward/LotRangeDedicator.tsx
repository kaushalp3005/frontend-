"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tag, ChevronDown, ChevronUp, X, Plus, Pencil, Check } from "lucide-react"

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
  // warehouse is accepted for API compatibility (callers pass it) but the
  // panel renders for ALL warehouses now — operators may want to assign lot
  // ranges on any inward, not only cold storage.
  void warehouse
  const [expanded, setExpanded] = useState(false)
  const [ranges, setRanges] = useState<LotRange[]>([])
  const [fromInput, setFromInput] = useState("")
  const [toInput, setToInput] = useState("")
  const [lotInput, setLotInput] = useState("")
  const [addError, setAddError] = useState<string | null>(null)
  // Inline editing of an already-added range (before "Apply to Boxes"). Lets operators
  // correct a mistyped lot/range without removing and re-adding the row.
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editFrom, setEditFrom] = useState("")
  const [editTo, setEditTo] = useState("")
  const [editLot, setEditLot] = useState("")
  const [editError, setEditError] = useState<string | null>(null)

  const startEdit = (idx: number) => {
    const r = ranges[idx]
    setEditIdx(idx)
    setEditFrom(String(r.from))
    setEditTo(String(r.to))
    setEditLot(r.lot)
    setEditError(null)
  }
  const cancelEdit = () => { setEditIdx(null); setEditError(null) }
  const saveEdit = () => {
    if (editIdx === null) return
    setEditError(null)
    const from = parseInt(editFrom)
    const to = parseInt(editTo)
    const lot = editLot.trim()
    if (!lot) { setEditError("Lot number is required"); return }
    if (isNaN(from) || from < 1) { setEditError("From box must be ≥ 1"); return }
    if (isNaN(to) || to < from) { setEditError("To box must be ≥ From box"); return }
    if (totalBoxes > 0 && to > totalBoxes) { setEditError(`To box must be ≤ ${totalBoxes}`); return }
    const overlap = ranges.find((r, i) => i !== editIdx && !(to < r.from || from > r.to))
    if (overlap) {
      setEditError(`Boxes ${overlap.from}–${overlap.to} are already assigned to Lot ${overlap.lot}.`)
      return
    }
    setRanges(prev => prev.map((r, i) => (i === editIdx ? { from, to, lot } : r)).sort((a, b) => a.from - b.from))
    setEditIdx(null)
  }

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
    setEditIdx(null)
    setEditError(null)
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
                <div key={i} className="text-xs bg-white border rounded px-2 py-1">
                  {editIdx === i ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Input
                        type="number" min="1" value={editFrom}
                        onChange={(e) => { setEditFrom(e.target.value); setEditError(null) }}
                        className="h-6 text-xs w-16"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number" min="1" value={editTo}
                        onChange={(e) => { setEditTo(e.target.value); setEditError(null) }}
                        className="h-6 text-xs w-16"
                      />
                      <span className="text-muted-foreground">→</span>
                      <Input
                        value={editLot}
                        onChange={(e) => { setEditLot(e.target.value); setEditError(null) }}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit() }}
                        className="h-6 text-xs w-24"
                        autoFocus
                      />
                      <button type="button" className="ml-auto text-emerald-600 hover:text-emerald-700" onClick={saveEdit} title="Save">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="text-muted-foreground hover:text-destructive" onClick={cancelEdit} title="Cancel">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Boxes {r.from}–{r.to}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">"{r.lot}"</span>
                      <button
                        type="button"
                        className="ml-auto text-muted-foreground hover:text-amber-600"
                        onClick={() => startEdit(i)}
                        title="Edit lot / range"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removeRange(i)}
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  {editIdx === i && editError && (
                    <p className="text-[11px] text-destructive mt-1">{editError}</p>
                  )}
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
