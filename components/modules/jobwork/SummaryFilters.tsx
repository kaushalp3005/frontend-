"use client"

import { Filter, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import type { GroupByOption } from "@/types/jobwork"

/* ── Chip sub-component ── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
        ${active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-300 hover:border-gray-500 hover:bg-gray-50"}`}>
      {label}{active && <span className="ml-1">&times;</span>}
    </button>
  )
}

/* ── Props ── */
interface SummaryFiltersProps {
  vendors: string[]
  items: string[]
  processTypes: string[]
  selVendors: Set<string>
  selItems: Set<string>
  selProcess: Set<string>
  selStatus: Set<string>
  selLoss: Set<string>
  dateFrom: string
  dateTo: string
  groupBy: GroupByOption
  onToggleVendor: (v: string) => void
  onToggleItem: (v: string) => void
  onToggleProcess: (v: string) => void
  onToggleStatus: (v: string) => void
  onToggleLoss: (v: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onGroupByChange: (v: GroupByOption) => void
  onClearAll: () => void
}

const JWO_STATUSES = ["Open", "Partially Received", "Fully Received", "Reconciled", "Closed"]
const LOSS_STATUSES = ["Normal", "Excess Loss", "Underweight Waste", "Pending"]
const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "vendor", label: "Vendor" },
  { value: "item", label: "Item" },
  { value: "process_type", label: "Process" },
  { value: "month", label: "Month" },
  { value: "jwo_status", label: "Status" },
]

export default function SummaryFilters({
  vendors,
  items,
  processTypes,
  selVendors,
  selItems,
  selProcess,
  selStatus,
  selLoss,
  dateFrom,
  dateTo,
  groupBy,
  onToggleVendor,
  onToggleItem,
  onToggleProcess,
  onToggleStatus,
  onToggleLoss,
  onDateFromChange,
  onDateToChange,
  onGroupByChange,
  onClearAll,
}: SummaryFiltersProps) {
  const filterCount =
    selVendors.size +
    selItems.size +
    selProcess.size +
    selStatus.size +
    selLoss.size +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold">Filters</span>
            {filterCount > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5">{filterCount} active</Badge>
            )}
          </div>
          {filterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 text-red-600 hover:text-red-700" onClick={onClearAll}>
              <X className="h-3 w-3 mr-1" />Clear all
            </Button>
          )}
        </div>

        {/* Date Range */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Date Range</label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="date" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} className="w-36 h-8 text-xs" />
            <span className="text-xs text-gray-400">to</span>
            <Input type="date" value={dateTo} onChange={e => onDateToChange(e.target.value)} className="w-36 h-8 text-xs" />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500" onClick={() => { onDateFromChange(""); onDateToChange("") }}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Vendor */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
            Vendor
            {selVendors.size > 0 && <span className="ml-1 text-gray-900">({selVendors.size})</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {vendors.map(v => (
              <Chip key={v} label={v} active={selVendors.has(v)} onClick={() => onToggleVendor(v)} />
            ))}
          </div>
        </div>

        {/* Item / Article */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
            Item / Article
            {selItems.size > 0 && <span className="ml-1 text-gray-900">({selItems.size})</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {items.map(v => (
              <Chip key={v} label={v} active={selItems.has(v)} onClick={() => onToggleItem(v)} />
            ))}
          </div>
        </div>

        {/* Process Type */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
            Process Type
            {selProcess.size > 0 && <span className="ml-1 text-gray-900">({selProcess.size})</span>}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {processTypes.map(v => (
              <Chip key={v} label={v} active={selProcess.has(v)} onClick={() => onToggleProcess(v)} />
            ))}
          </div>
        </div>

        {/* Status + Loss in one row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              JWO Status
              {selStatus.size > 0 && <span className="ml-1 text-gray-900">({selStatus.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {JWO_STATUSES.map(v => (
                <Chip key={v} label={v} active={selStatus.has(v)} onClick={() => onToggleStatus(v)} />
              ))}
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">
              Loss Status
              {selLoss.size > 0 && <span className="ml-1 text-gray-900">({selLoss.size})</span>}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {LOSS_STATUSES.map(v => (
                <Chip key={v} label={v} active={selLoss.has(v)} onClick={() => onToggleLoss(v)} />
              ))}
            </div>
          </div>
        </div>

        {/* Group By */}
        <div>
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1.5 block">Group By</label>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_BY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onGroupByChange(opt.value)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap
                  ${groupBy === opt.value
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-300 hover:border-gray-500 hover:bg-gray-50"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
