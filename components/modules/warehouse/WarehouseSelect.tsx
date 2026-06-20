"use client"

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { WAREHOUSES, getWarehouseName } from "@/lib/constants/warehouses"

export interface WarehouseOption { code: string; label: string }

/** Pure: canonical warehouse options derived from the shared constant.
 *  coldOnly restricts to cold warehouses. value = canonical code, label = display name. */
export function getWarehouseOptions(coldOnly = false): WarehouseOption[] {
  return Object.entries(WAREHOUSES)
    .filter(([, w]) => (coldOnly ? w.type === "cold" : true))
    .map(([code]) => ({ code, label: getWarehouseName(code) }))
}

interface WarehouseSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  coldOnly?: boolean
}

export function WarehouseSelect({
  value, onChange, placeholder = "Select factory", className = "h-9", coldOnly = false,
}: WarehouseSelectProps) {
  const options = getWarehouseOptions(coldOnly)
  const codes = options.map((o) => o.code)
  // Preserve a legacy/unknown stored value so the control still shows it.
  const showLegacy = value && !codes.includes(value)

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {showLegacy && <SelectItem value={value}>{getWarehouseName(value)}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
