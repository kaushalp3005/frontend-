"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  options: Array<{ value: string; label: string }>
  className?: string
  disabled?: boolean
  loading?: boolean
  error?: string | null
  onSearchChange?: (query: string) => void
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No options found.",
  options,
  className,
  disabled = false,
  loading = false,
  error = null,
  onSearchChange,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  // Use options directly from parent (no local filtering)
  // The parent component handles the filtering via API calls
  const filteredOptions = options

  // Clear search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("")
      onSearchChange?.("")
    }
  }, [open, onSearchChange])

  // Notify parent of search changes
  React.useEffect(() => {
    onSearchChange?.(searchQuery)
  }, [searchQuery, onSearchChange])

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              !selectedOption && "text-muted-foreground",
              error && "border-red-500",
              className
            )}
            disabled={disabled}
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </span>
            ) : selectedOption ? (
              <span className="truncate">{selectedOption.label}</span>
            ) : (
              placeholder
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] max-w-[--radix-popover-trigger-width] p-0"
          align="start"
          sideOffset={4}
        >
          <Command shouldFilter={false} className="w-full overflow-hidden">
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="border-none focus:ring-0"
            />
            <CommandList className="max-h-60 overflow-y-auto overflow-x-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Searching...</span>
                </div>
              ) : (
                <>
                  <CommandEmpty>{emptyText}</CommandEmpty>
                  <CommandGroup className="overflow-hidden">
                    {filteredOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          // Use option.value directly from closure to avoid lowercasing issues
                          onValueChange(option.value)
                          setOpen(false)
                          setSearchQuery("")
                        }}
                        className="cursor-pointer flex items-center gap-2 overflow-hidden"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            value === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="truncate block overflow-hidden text-ellipsis whitespace-nowrap flex-1 min-w-0">
                          {option.label}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  )
}