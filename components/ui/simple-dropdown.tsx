"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SimpleDropdownProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  options: Array<{ value: string; label: string }>
  className?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
}

export function SimpleDropdown({
  value,
  onValueChange,
  placeholder = "Select option...",
  options,
  className,
  disabled = false,
  loading = false,
  error = null,
}: SimpleDropdownProps) {

  return (
    <div className="relative">
      <Select 
        value={value} 
        onValueChange={onValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger 
          className={cn(
            "w-full",
            error && "border-red-500",
            className
          )}
        >
          <SelectValue placeholder={loading ? "Loading..." : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {error ? (
            <div className="p-2 text-sm text-red-500">
              {error}
            </div>
          ) : options.length === 0 && !loading ? (
            <div className="p-2 text-sm text-muted-foreground">
              No options available
            </div>
          ) : (
            options
              .filter((option) => option.value && option.value.trim() !== "")
              .map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))
          )}
        </SelectContent>
      </Select>
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}
