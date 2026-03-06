// API Configuration
// File: lib/config.ts

export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    timeout: 30000, // 30 seconds
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
  },

  // Dropdown Configuration
  dropdowns: {
    searchDebounceMs: 300,
    maxResults: 50,
    minSearchLength: 1,
  },

  // Pagination Configuration
  pagination: {
    defaultPageSize: 20,
    maxPageSize: 100,
  },

  // Error Messages
  errors: {
    networkError: 'Network error. Please check your connection.',
    serverError: 'Server error. Please try again later.',
    notFound: 'Resource not found.',
    unauthorized: 'You are not authorized to perform this action.',
    forbidden: 'Access denied.',
    validationError: 'Please check your input and try again.',
  },

  // Success Messages
  success: {
    created: 'Record created successfully.',
    updated: 'Record updated successfully.',
    deleted: 'Record deleted successfully.',
  }
}

export default config
