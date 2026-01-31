// hooks/useDateHandling.ts
"use client"

import { useState, useCallback, useEffect } from "react"
import { DateUtils, DateFormatOptions, DateValidationResult } from "@/lib/utils/dateUtils"

export interface UseDateHandlingProps {
  initialDate?: Date | string
  format?: string
  timezone?: string
  locale?: string
  validateOnChange?: boolean
  required?: boolean
}

export interface UseDateHandlingReturn {
  // State
  date: Date | null
  dateString: string
  isValid: boolean
  error: string | null
  isDirty: boolean
  
  // Actions
  setDate: (date: Date | string | null) => void
  setDateString: (dateString: string) => void
  clearDate: () => void
  validateDate: () => DateValidationResult
  
  // Utilities
  formatDate: (format?: string) => string
  getRelativeTime: () => string
  isToday: () => boolean
  isPast: () => boolean
  isFuture: () => boolean
}

export function useDateHandling({
  initialDate,
  format = DateUtils.DEFAULT_FORMATS.DATETIME,
  timezone = DateUtils.DEFAULT_TIMEZONE,
  locale,
  validateOnChange = true,
  required = false
}: UseDateHandlingProps = {}): UseDateHandlingReturn {
  const [date, setDateState] = useState<Date | null>(() => {
    if (initialDate) {
      return typeof initialDate === 'string' ? DateUtils.parseDate(initialDate) : initialDate
    }
    return null
  })
  
  const [dateString, setDateStringState] = useState<string>(() => {
    if (initialDate) {
      return typeof initialDate === 'string' ? initialDate : DateUtils.formatDate(initialDate, format)
    }
    return ''
  })
  
  const [isValid, setIsValid] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState<boolean>(false)

  const options: DateFormatOptions = { format, timezone, locale }

  const setDate = useCallback((newDate: Date | string | null) => {
    if (newDate === null) {
      setDateState(null)
      setDateStringState('')
      setIsValid(!required)
      setError(required ? 'Date is required' : null)
      setIsDirty(true)
      return
    }

    const dateObj = typeof newDate === 'string' ? DateUtils.parseDate(newDate, format, options) : newDate
    
    if (!dateObj) {
      setDateState(null)
      setDateStringState('')
      setIsValid(false)
      setError('Invalid date format')
      setIsDirty(true)
      return
    }

    setDateState(dateObj)
    setDateStringState(DateUtils.formatDate(dateObj, format, options))
    setIsValid(true)
    setError(null)
    setIsDirty(true)
  }, [format, options, required])

  const setDateString = useCallback((newDateString: string) => {
    setDateStringState(newDateString)
    
    if (newDateString.trim() === '') {
      setDateState(null)
      setIsValid(!required)
      setError(required ? 'Date is required' : null)
      setIsDirty(true)
      return
    }

    const parsedDate = DateUtils.parseDate(newDateString, format, options)
    
    if (!parsedDate) {
      setDateState(null)
      setIsValid(false)
      setError('Invalid date format')
      setIsDirty(true)
      return
    }

    setDateState(parsedDate)
    setIsValid(true)
    setError(null)
    setIsDirty(true)
  }, [format, options, required])

  const clearDate = useCallback(() => {
    setDateState(null)
    setDateStringState('')
    setIsValid(!required)
    setError(required ? 'Date is required' : null)
    setIsDirty(true)
  }, [required])

  const validateDate = useCallback((): DateValidationResult => {
    if (dateString.trim() === '') {
      if (required) {
        return {
          isValid: false,
          error: 'Date is required'
        }
      }
      return {
        isValid: true
      }
    }

    return DateUtils.validateDate(dateString, format, options)
  }, [dateString, format, options, required])

  const formatDate = useCallback((customFormat?: string) => {
    if (!date) return ''
    return DateUtils.formatDate(date, customFormat || format, options)
  }, [date, format, options])

  const getRelativeTime = useCallback(() => {
    if (!date) return ''
    return DateUtils.getRelativeTime(date)
  }, [date])

  const isToday = useCallback(() => {
    if (!date) return false
    return DateUtils.isToday(date)
  }, [date])

  const isPast = useCallback(() => {
    if (!date) return false
    return DateUtils.isPast(date)
  }, [date])

  const isFuture = useCallback(() => {
    if (!date) return false
    return DateUtils.isFuture(date)
  }, [date])

  // Validate on change if enabled
  useEffect(() => {
    if (validateOnChange) {
      const validation = validateDate()
      setIsValid(validation.isValid)
      setError(validation.error || null)
    }
  }, [dateString, validateOnChange, validateDate])

  return {
    date,
    dateString,
    isValid,
    error,
    isDirty,
    setDate,
    setDateString,
    clearDate,
    validateDate,
    formatDate,
    getRelativeTime,
    isToday,
    isPast,
    isFuture
  }
}

// Hook for date range handling
export interface UseDateRangeHandlingProps {
  initialStartDate?: Date | string
  initialEndDate?: Date | string
  format?: string
  timezone?: string
  locale?: string
  validateOnChange?: boolean
  required?: boolean
}

export interface UseDateRangeHandlingReturn {
  // State
  startDate: Date | null
  endDate: Date | null
  startDateString: string
  endDateString: string
  isValid: boolean
  error: string | null
  isDirty: boolean
  
  // Actions
  setStartDate: (date: Date | string | null) => void
  setEndDate: (date: Date | string | null) => void
  setStartDateString: (dateString: string) => void
  setEndDateString: (dateString: string) => void
  clearRange: () => void
  validateRange: () => { isValid: boolean; error?: string }
  
  // Utilities
  getDaysBetween: () => number
  getBusinessDaysBetween: () => number
  isStartDateBeforeEndDate: () => boolean
}

export function useDateRangeHandling({
  initialStartDate,
  initialEndDate,
  format = DateUtils.DEFAULT_FORMATS.DATETIME,
  timezone = DateUtils.DEFAULT_TIMEZONE,
  locale,
  validateOnChange = true,
  required = false
}: UseDateRangeHandlingProps = {}): UseDateRangeHandlingReturn {
  const startDateHook = useDateHandling({
    initialDate: initialStartDate,
    format,
    timezone,
    locale,
    validateOnChange,
    required
  })

  const endDateHook = useDateHandling({
    initialDate: initialEndDate,
    format,
    timezone,
    locale,
    validateOnChange,
    required
  })

  const [isDirty, setIsDirty] = useState<boolean>(false)

  const validateRange = useCallback(() => {
    const startValidation = startDateHook.validateDate()
    const endValidation = endDateHook.validateDate()

    if (!startValidation.isValid) {
      return {
        isValid: false,
        error: startValidation.error || 'Invalid start date'
      }
    }

    if (!endValidation.isValid) {
      return {
        isValid: false,
        error: endValidation.error || 'Invalid end date'
      }
    }

    if (startDateHook.date && endDateHook.date) {
      const rangeValidation = DateUtils.validateDateRange(
        startDateHook.dateString,
        endDateHook.dateString
      )
      
      if (!rangeValidation.isValid) {
        return {
          isValid: false,
          error: rangeValidation.error || 'Start date must be before end date'
        }
      }
    }

    return { isValid: true }
  }, [startDateHook, endDateHook])

  const getDaysBetween = useCallback(() => {
    if (!startDateHook.date || !endDateHook.date) return 0
    return DateUtils.getDaysBetween(startDateHook.date, endDateHook.date)
  }, [startDateHook.date, endDateHook.date])

  const getBusinessDaysBetween = useCallback(() => {
    if (!startDateHook.date || !endDateHook.date) return 0
    return DateUtils.getBusinessDaysBetween(startDateHook.date, endDateHook.date)
  }, [startDateHook.date, endDateHook.date])

  const isStartDateBeforeEndDate = useCallback(() => {
    if (!startDateHook.date || !endDateHook.date) return true
    return startDateHook.date <= endDateHook.date
  }, [startDateHook.date, endDateHook.date])

  const clearRange = useCallback(() => {
    startDateHook.clearDate()
    endDateHook.clearDate()
    setIsDirty(true)
  }, [startDateHook, endDateHook])

  // Update dirty state when either date changes
  useEffect(() => {
    setIsDirty(startDateHook.isDirty || endDateHook.isDirty)
  }, [startDateHook.isDirty, endDateHook.isDirty])

  // Validate range when dates change
  useEffect(() => {
    if (validateOnChange) {
      const validation = validateRange()
      // Update validation state based on range validation
    }
  }, [startDateHook.dateString, endDateHook.dateString, validateOnChange, validateRange])

  return {
    startDate: startDateHook.date,
    endDate: endDateHook.date,
    startDateString: startDateHook.dateString,
    endDateString: endDateHook.dateString,
    isValid: startDateHook.isValid && endDateHook.isValid,
    error: startDateHook.error || endDateHook.error,
    isDirty,
    setStartDate: startDateHook.setDate,
    setEndDate: endDateHook.setDate,
    setStartDateString: startDateHook.setDateString,
    setEndDateString: endDateHook.setDateString,
    clearRange,
    validateRange,
    getDaysBetween,
    getBusinessDaysBetween,
    isStartDateBeforeEndDate
  }
}
