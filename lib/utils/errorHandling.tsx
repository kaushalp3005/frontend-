// lib/utils/errorHandling.ts
import { Company } from '@/lib/api'

export interface AppError extends Error {
  code?: string
  statusCode?: number
  context?: Record<string, any>
  timestamp?: string
  userId?: string
  company?: Company
}

export interface ErrorContext {
  component?: string
  action?: string
  data?: any
  userId?: string
  company?: Company
}

export class InwardFormError extends Error implements AppError {
  code: string
  statusCode: number
  context: Record<string, any>
  timestamp: string
  userId?: string
  company?: Company

  constructor(
    message: string,
    code: string = 'INWARD_FORM_ERROR',
    statusCode: number = 500,
    context: Record<string, any> = {},
    userId?: string,
    company?: Company
  ) {
    super(message)
    this.name = 'InwardFormError'
    this.code = code
    this.statusCode = statusCode
    this.context = context
    this.timestamp = new Date().toISOString()
    this.userId = userId
    this.company = company
  }
}

export class ValidationError extends InwardFormError {
  constructor(message: string, field: string, value: any, context: Record<string, any> = {}) {
    super(message, 'VALIDATION_ERROR', 400, { field, value, ...context })
    this.name = 'ValidationError'
  }
}

export class SKUResolutionError extends InwardFormError {
  constructor(message: string, articleData: any, context: Record<string, any> = {}) {
    super(message, 'SKU_RESOLUTION_ERROR', 404, { articleData, ...context })
    this.name = 'SKUResolutionError'
  }
}

export class PrinterError extends InwardFormError {
  constructor(message: string, printerName: string, context: Record<string, any> = {}) {
    super(message, 'PRINTER_ERROR', 500, { printerName, ...context })
    this.name = 'PrinterError'
  }
}

export class APIError extends InwardFormError {
  constructor(message: string, endpoint: string, statusCode: number, context: Record<string, any> = {}) {
    super(message, 'API_ERROR', statusCode, { endpoint, ...context })
    this.name = 'APIError'
  }
}

export class NetworkError extends InwardFormError {
  constructor(message: string, context: Record<string, any> = {}) {
    super(message, 'NETWORK_ERROR', 0, context)
    this.name = 'NetworkError'
  }
}

export class PermissionError extends InwardFormError {
  constructor(message: string, requiredPermission: string, context: Record<string, any> = {}) {
    super(message, 'PERMISSION_ERROR', 403, { requiredPermission, ...context })
    this.name = 'PermissionError'
  }
}

export class DataIntegrityError extends InwardFormError {
  constructor(message: string, data: any, context: Record<string, any> = {}) {
    super(message, 'DATA_INTEGRITY_ERROR', 422, { data, ...context })
    this.name = 'DataIntegrityError'
  }
}

// Error handling utilities
export class ErrorHandler {
  private static errorLog: AppError[] = []
  private static maxLogSize = 100

  static logError(error: AppError, context?: ErrorContext) {
    // Add context to error
    if (context) {
      error.context = { ...error.context, ...context }
    }

    // Add to local log
    this.errorLog.unshift(error)
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.maxLogSize)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error logged:', {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        context: error.context,
        timestamp: error.timestamp,
        stack: error.stack
      })
    }

    // Send to external error tracking service
    this.sendToErrorService(error)
  }

  private static async sendToErrorService(error: AppError) {
    try {
      // In a real application, you would send this to an error tracking service
      // like Sentry, LogRocket, or Bugsnag
      const errorData = {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        context: error.context,
        timestamp: error.timestamp,
        stack: error.stack,
        userAgent: navigator.userAgent,
        url: window.location.href
      }

      // Example: Send to error tracking service
      // await errorTrackingService.captureException(error, { extra: errorData })
      
      console.log('Error sent to tracking service:', errorData)
    } catch (trackingError) {
      console.error('Failed to send error to tracking service:', trackingError)
    }
  }

  static getErrorLog(): AppError[] {
    return [...this.errorLog]
  }

  static clearErrorLog() {
    this.errorLog = []
  }

  static getErrorCount(): number {
    return this.errorLog.length
  }

  static getErrorsByCode(code: string): AppError[] {
    return this.errorLog.filter(error => error.code === code)
  }

  static getRecentErrors(count: number = 10): AppError[] {
    return this.errorLog.slice(0, count)
  }
}

// Error recovery utilities
export class ErrorRecovery {
  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    context?: ErrorContext
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          const appError = this.wrapError(error as Error, context)
          ErrorHandler.logError(appError, context)
          throw appError
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }

    throw lastError
  }

  static wrapError(error: Error, context?: ErrorContext): AppError {
    if (error instanceof InwardFormError) {
      return error
    }

    // Determine error type based on error properties
    if (error.name === 'NetworkError' || error.message.includes('fetch')) {
      return new NetworkError(error.message, context)
    }

    if (error.message.includes('SKU') || error.message.includes('sku')) {
      return new SKUResolutionError(error.message, context?.data, context)
    }

    if (error.message.includes('printer') || error.message.includes('print')) {
      return new PrinterError(error.message, context?.data?.printerName || 'unknown', context)
    }

    if (error.message.includes('validation') || error.message.includes('required')) {
      return new ValidationError(error.message, context?.data?.field || 'unknown', context?.data?.value, context)
    }

    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      return new PermissionError(error.message, context?.data?.requiredPermission || 'unknown', context)
    }

    // Default to generic InwardFormError
    return new InwardFormError(error.message, 'UNKNOWN_ERROR', 500, context)
  }

  static async handleAPIError(response: Response, context?: ErrorContext): Promise<never> {
    let errorMessage = `API request failed with status ${response.status}`
    let errorData: any = null

    try {
      errorData = await response.json()

      // Handle FastAPI validation errors (422 responses)
      if (response.status === 422 && errorData.detail) {
        if (Array.isArray(errorData.detail)) {
          // Format validation errors nicely
          errorMessage = 'Validation Error: ' + errorData.detail.map((err: any) =>
            `${err.loc?.join('.')} - ${err.msg}`
          ).join(', ')
        } else if (typeof errorData.detail === 'object') {
          errorMessage = `Validation Error: ${JSON.stringify(errorData.detail)}`
        } else {
          errorMessage = `Validation Error: ${errorData.detail}`
        }
      } else {
        // Handle other error formats
        errorMessage = errorData.message || errorData.error ||
                      (typeof errorData.detail === 'string' ? errorData.detail : null) ||
                      errorMessage
      }
    } catch {
      // If we can't parse the response, use the status text
      errorMessage = response.statusText || errorMessage
    }

    // Handle 401 Unauthorized - JWT expired or invalid
    if (response.status === 401) {
      console.warn('[ERROR] Unauthorized (401) - Session expired, redirecting to login')
      
      // Clear auth data
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-storage')
        sessionStorage.clear()
        
        // Redirect to login with session expired message
        window.location.href = '/login?session_expired=true'
      }
      
      const error = new APIError(
        'Your session has expired. Please log in again.',
        context?.data?.endpoint || 'unknown',
        401,
        { responseData: errorData, ...context }
      )
      
      ErrorHandler.logError(error, context)
      throw error
    }

    const error = new APIError(
      errorMessage,
      context?.data?.endpoint || 'unknown',
      response.status,
      { responseData: errorData, ...context }
    )

    ErrorHandler.logError(error, context)
    throw error
  }

  static async handleNetworkError(error: Error, context?: ErrorContext): Promise<never> {
    const networkError = new NetworkError(
      error.message || 'Network request failed',
      { originalError: error.message, ...context }
    )

    ErrorHandler.logError(networkError, context)
    throw networkError
  }
}

// Error boundary utilities
export function createErrorBoundaryFallback(error: AppError, retry: () => void) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">!</span>
            </div>
            <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          </div>
          
          <div className="space-y-3">
            <p className="text-red-700">{error.message}</p>
            
            {error.code && (
              <p className="text-sm text-red-600">
                Error Code: <code className="bg-red-100 px-1 py-0.5 rounded">{error.code}</code>
              </p>
            )}
            
            {process.env.NODE_ENV === 'development' && error.context && (
              <details className="text-sm">
                <summary className="cursor-pointer text-red-600 font-medium">Error Details</summary>
                <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                  {JSON.stringify(error.context, null, 2)}
                </pre>
              </details>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={retry}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Error message utilities
export function getErrorMessage(error: AppError): string {
  switch (error.code) {
    case 'VALIDATION_ERROR':
      return `Validation failed: ${error.message}`
    case 'SKU_RESOLUTION_ERROR':
      return `Failed to resolve SKU ID: ${error.message}`
    case 'PRINTER_ERROR':
      return `Printer error: ${error.message}`
    case 'API_ERROR':
      return `API request failed: ${error.message}`
    case 'NETWORK_ERROR':
      return `Network error: ${error.message}`
    case 'PERMISSION_ERROR':
      return `Permission denied: ${error.message}`
    case 'DATA_INTEGRITY_ERROR':
      return `Data integrity error: ${error.message}`
    default:
      return error.message
  }
}

export function isRetryableError(error: AppError): boolean {
  const retryableCodes = ['NETWORK_ERROR', 'API_ERROR']
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504]
  
  const hasRetryableCode = error.code !== undefined && retryableCodes.includes(error.code)
  const hasRetryableStatus = error.statusCode !== undefined && retryableStatusCodes.includes(error.statusCode)
  
  return hasRetryableCode || hasRetryableStatus
}

export function getRetryDelay(error: AppError, attempt: number): number {
  // Exponential backoff with jitter
  const baseDelay = 1000
  const maxDelay = 30000
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay)
  const jitter = Math.random() * 0.1 * delay
  
  return delay + jitter
}
