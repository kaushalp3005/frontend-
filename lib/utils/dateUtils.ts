  // lib/utils/dateUtils.ts
  import { format, parseISO, isValid, addDays, subDays, startOfDay, endOfDay } from 'date-fns'
  // Note: Install date-fns-tz package to enable timezone conversion features
  // import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz'

  export interface DateFormatOptions {
    format?: string
    timezone?: string
    locale?: string
  }

  export interface DateValidationResult {
    isValid: boolean
    error?: string
    parsedDate?: Date
  }

  export interface DateRange {
    start: Date
    end: Date
  }

  export class DateUtils {
    // Default formats
    static readonly DEFAULT_FORMATS = {
      DATE: 'yyyy-MM-dd',
      TIME: 'HH:mm:ss',
      DATETIME: 'yyyy-MM-dd\'T\'HH:mm:ss',
      DISPLAY_DATE: 'MMM dd, yyyy',
      DISPLAY_TIME: 'h:mm a',
      DISPLAY_DATETIME: 'MMM dd, yyyy h:mm a',
      ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx'
    }

    // Timezone handling
    static readonly DEFAULT_TIMEZONE = 'Asia/Kolkata'

    /**
     * Format a date using the specified format
     */
    static formatDate(
      date: Date | string | number,
      formatString: string = this.DEFAULT_FORMATS.DATE,
      options?: DateFormatOptions
    ): string {
      try {
        let dateObj: Date

        if (typeof date === 'string') {
          dateObj = parseISO(date)
        } else if (typeof date === 'number') {
          dateObj = new Date(date)
        } else {
          dateObj = date
        }

        if (!isValid(dateObj)) {
          throw new Error('Invalid date')
        }

        // Handle timezone conversion if specified
        // Note: Install date-fns-tz package to enable this feature
        // if (options?.timezone) {
        //   dateObj = utcToZonedTime(dateObj, options.timezone)
        // }

        return format(dateObj, formatString)
      } catch (error) {
        console.error('Date formatting error:', error)
        return ''
      }
    }

    /**
     * Parse a date string and return a Date object
     */
    static parseDate(
      dateString: string,
      formatString?: string,
      options?: DateFormatOptions
    ): Date | null {
      try {
        if (!dateString || dateString.trim() === '') {
          return null
        }

        let date: Date

        if (formatString) {
          // Parse with specific format
          date = parseISO(dateString)
        } else {
          // Try to parse as ISO string first
          date = parseISO(dateString)
          
          // If that fails, try as regular Date constructor
          if (!isValid(date)) {
            date = new Date(dateString)
          }
        }

        if (!isValid(date)) {
          throw new Error('Invalid date format')
        }

        // Handle timezone conversion if specified
        // Note: Install date-fns-tz package to enable this feature
        // if (options?.timezone) {
        //   date = zonedTimeToUtc(date, options.timezone)
        // }

        return date
      } catch (error) {
        console.error('Date parsing error:', error)
        return null
      }
    }

    /**
     * Validate a date string
     */
    static validateDate(
      dateString: string,
      formatString?: string,
      options?: DateFormatOptions
    ): DateValidationResult {
      try {
        if (!dateString || dateString.trim() === '') {
          return {
            isValid: false,
            error: 'Date is required'
          }
        }

        const parsedDate = this.parseDate(dateString, formatString, options)
        
        if (!parsedDate) {
          return {
            isValid: false,
            error: 'Invalid date format'
          }
        }

        return {
          isValid: true,
          parsedDate
        }
      } catch (error) {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown date validation error'
        }
      }
    }

    /**
     * Get current date in specified format
     */
    static getCurrentDate(formatString?: string, options?: DateFormatOptions): string {
      return this.formatDate(new Date(), formatString, options)
    }

    /**
     * Get current date as Date object
     */
    static getCurrentDateObject(): Date {
      return new Date()
    }

    /**
     * Add days to a date
     */
    static addDays(date: Date | string, days: number): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return addDays(dateObj, days)
    }

    /**
     * Subtract days from a date
     */
    static subtractDays(date: Date | string, days: number): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return subDays(dateObj, days)
    }

    /**
     * Get start of day
     */
    static getStartOfDay(date: Date | string): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return startOfDay(dateObj)
    }

    /**
     * Get end of day
     */
    static getEndOfDay(date: Date | string): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return endOfDay(dateObj)
    }

    /**
     * Check if a date is today
     */
    static isToday(date: Date | string): boolean {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      const today = new Date()
      return dateObj.toDateString() === today.toDateString()
    }

    /**
     * Check if a date is in the past
     */
    static isPast(date: Date | string): boolean {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return dateObj < new Date()
    }

    /**
     * Check if a date is in the future
     */
    static isFuture(date: Date | string): boolean {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return dateObj > new Date()
    }

    /**
     * Check if a date is within a range
     */
    static isWithinRange(date: Date | string, range: DateRange): boolean {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      return dateObj >= range.start && dateObj <= range.end
    }

    /**
     * Get date range for common periods
     */
    static getDateRange(period: 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear'): DateRange {
      const now = new Date()
      
      switch (period) {
        case 'today':
          return {
            start: startOfDay(now),
            end: endOfDay(now)
          }
        case 'yesterday':
          const yesterday = subDays(now, 1)
          return {
            start: startOfDay(yesterday),
            end: endOfDay(yesterday)
          }
        case 'thisWeek':
          const startOfWeek = subDays(now, now.getDay())
          return {
            start: startOfDay(startOfWeek),
            end: endOfDay(now)
          }
        case 'lastWeek':
          const lastWeekStart = subDays(now, now.getDay() + 7)
          const lastWeekEnd = subDays(now, now.getDay() + 1)
          return {
            start: startOfDay(lastWeekStart),
            end: endOfDay(lastWeekEnd)
          }
        case 'thisMonth':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          return {
            start: startOfDay(startOfMonth),
            end: endOfDay(now)
          }
        case 'lastMonth':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
          return {
            start: startOfDay(lastMonthStart),
            end: endOfDay(lastMonthEnd)
          }
        case 'thisYear':
          const startOfYear = new Date(now.getFullYear(), 0, 1)
          return {
            start: startOfDay(startOfYear),
            end: endOfDay(now)
          }
        case 'lastYear':
          const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
          const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31)
          return {
            start: startOfDay(lastYearStart),
            end: endOfDay(lastYearEnd)
          }
        default:
          throw new Error(`Unknown period: ${period}`)
      }
    }

    /**
     * Format date for display in UI
     */
    static formatForDisplay(date: Date | string, options?: DateFormatOptions): string {
      return this.formatDate(date, this.DEFAULT_FORMATS.DISPLAY_DATETIME, options)
    }

    /**
     * Format date for form input
     */
    static formatForInput(date: Date | string, options?: DateFormatOptions): string {
      return this.formatDate(date, this.DEFAULT_FORMATS.DATETIME, options)
    }

    /**
     * Format date for API
     */
    static formatForAPI(date: Date | string, options?: DateFormatOptions): string {
      return this.formatDate(date, this.DEFAULT_FORMATS.ISO, options)
    }

    /**
     * Get relative time string (e.g., "2 hours ago", "in 3 days")
     */
    static getRelativeTime(date: Date | string): string {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      const now = new Date()
      const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

      if (diffInSeconds < 60) {
        return 'just now'
      } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60)
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 2592000) {
        const days = Math.floor(diffInSeconds / 86400)
        return `${days} day${days !== 1 ? 's' : ''} ago`
      } else if (diffInSeconds < 31536000) {
        const months = Math.floor(diffInSeconds / 2592000)
        return `${months} month${months !== 1 ? 's' : ''} ago`
      } else {
        const years = Math.floor(diffInSeconds / 31536000)
        return `${years} year${years !== 1 ? 's' : ''} ago`
      }
    }

    /**
     * Check if two dates are the same day
     */
    static isSameDay(date1: Date | string, date2: Date | string): boolean {
      const d1 = typeof date1 === 'string' ? parseISO(date1) : date1
      const d2 = typeof date2 === 'string' ? parseISO(date2) : date2
      return d1.toDateString() === d2.toDateString()
    }

    /**
     * Get days between two dates
     */
    static getDaysBetween(date1: Date | string, date2: Date | string): number {
      const d1 = typeof date1 === 'string' ? parseISO(date1) : date1
      const d2 = typeof date2 === 'string' ? parseISO(date2) : date2
      const diffTime = Math.abs(d2.getTime() - d1.getTime())
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    /**
     * Validate date range
     */
    static validateDateRange(startDate: string, endDate: string): { isValid: boolean; error?: string } {
      const start = this.parseDate(startDate)
      const end = this.parseDate(endDate)

      if (!start) {
        return { isValid: false, error: 'Invalid start date' }
      }

      if (!end) {
        return { isValid: false, error: 'Invalid end date' }
      }

      if (start > end) {
        return { isValid: false, error: 'Start date must be before end date' }
      }

      return { isValid: true }
    }

    /**
     * Get business days between two dates (excluding weekends)
     */
    static getBusinessDaysBetween(date1: Date | string, date2: Date | string): number {
      const d1 = typeof date1 === 'string' ? parseISO(date1) : date1
      const d2 = typeof date2 === 'string' ? parseISO(date2) : date2
      
      let count = 0
      const current = new Date(d1)
      
      while (current <= d2) {
        const dayOfWeek = current.getDay()
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
          count++
        }
        current.setDate(current.getDate() + 1)
      }
      
      return count
    }

    /**
     * Get next business day
     */
    static getNextBusinessDay(date: Date | string): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      let nextDay = addDays(dateObj, 1)
      
      while (nextDay.getDay() === 0 || nextDay.getDay() === 6) {
        nextDay = addDays(nextDay, 1)
      }
      
      return nextDay
    }

    /**
     * Get previous business day
     */
    static getPreviousBusinessDay(date: Date | string): Date {
      const dateObj = typeof date === 'string' ? parseISO(date) : date
      let prevDay = subDays(dateObj, 1)
      
      while (prevDay.getDay() === 0 || prevDay.getDay() === 6) {
        prevDay = subDays(prevDay, 1)
      }
      
      return prevDay
    }
  }
