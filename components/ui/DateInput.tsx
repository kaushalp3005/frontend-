// components/ui/DateInput.tsx
"use client"

import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateHandling } from "@/hooks/useDateHandling"
import { DateUtils } from "@/lib/utils/dateUtils"

interface DateInputProps {
  label?: string
  value?: Date | string
  onChange?: (date: Date | null) => void
  onBlur?: () => void
  placeholder?: string
  format?: string
  timezone?: string
  locale?: string
  required?: boolean
  disabled?: boolean
  error?: string
  className?: string
  showClearButton?: boolean
  showCalendar?: boolean
  minDate?: Date
  maxDate?: Date
}

export function DateInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder = "Select date",
  format = DateUtils.DEFAULT_FORMATS.DATETIME,
  timezone = DateUtils.DEFAULT_TIMEZONE,
  locale,
  required = false,
  disabled = false,
  error,
  className,
  showClearButton = true,
  showCalendar = true,
  minDate,
  maxDate
}: DateInputProps) {
  const {
    date,
    dateString,
    isValid,
    error: validationError,
    setDate,
    setDateString,
    clearDate,
    isToday,
    isPast,
    isFuture
  } = useDateHandling({
    initialDate: value,
    format,
    timezone,
    locale,
    validateOnChange: true,
    required
  })

  const [isCalendarOpen, setIsCalendarOpen] = React.useState(false)

  const handleDateChange = (newDate: Date | null) => {
    setDate(newDate)
    onChange?.(newDate)
  }

  const handleStringChange = (newString: string) => {
    setDateString(newString)
    if (date) {
      onChange?.(date)
    }
  }

  const handleClear = () => {
    clearDate()
    onChange?.(null)
  }

  const displayError = error || validationError

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor="date-input" className={cn(required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
          {label}
        </Label>
      )}
      
      <div className="relative">
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                displayError && "border-red-500 focus:border-red-500"
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? DateUtils.formatForDisplay(date) : placeholder}
            </Button>
          </PopoverTrigger>
          
          {showCalendar && (
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date || undefined}
                onSelect={handleDateChange}
                disabled={(date) => {
                  if (minDate && date < minDate) return true
                  if (maxDate && date > maxDate) return true
                  return false
                }}
                initialFocus
              />
            </PopoverContent>
          )}
        </Popover>

        <Input
          id="date-input"
          type="text"
          value={dateString}
          onChange={(e) => handleStringChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "mt-2",
            displayError && "border-red-500 focus:border-red-500"
          )}
        />

        {showClearButton && date && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-2 top-2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {displayError && (
        <p className="text-sm text-red-500">{displayError}</p>
      )}

      {/* Date status indicators */}
      {date && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isToday() && <span className="text-blue-500">Today</span>}
          {isPast() && !isToday() && <span className="text-orange-500">Past</span>}
          {isFuture() && <span className="text-green-500">Future</span>}
        </div>
      )}
    </div>
  )
}
