// hooks/useLoadingStates.ts
"use client"

import { useState, useCallback } from "react"

export interface LoadingState {
  isLoading: boolean
  loadingMessage?: string
  progress?: number
  error?: string
}

export interface LoadingStates {
  form: LoadingState
  articles: LoadingState
  boxes: LoadingState
  validation: LoadingState
  submission: LoadingState
  printing: LoadingState
  dropdowns: LoadingState
  skuResolution: LoadingState
}

export function useLoadingStates() {
  const [loadingStates, setLoadingStates] = useState<LoadingStates>({
    form: { isLoading: false },
    articles: { isLoading: false },
    boxes: { isLoading: false },
    validation: { isLoading: false },
    submission: { isLoading: false },
    printing: { isLoading: false },
    dropdowns: { isLoading: false },
    skuResolution: { isLoading: false }
  })

  const setLoading = useCallback((
    key: keyof LoadingStates,
    isLoading: boolean,
    message?: string,
    progress?: number,
    error?: string
  ) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        isLoading,
        loadingMessage: message,
        progress,
        error
      }
    }))
  }, [])

  const setError = useCallback((key: keyof LoadingStates, error: string) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        isLoading: false,
        error
      }
    }))
  }, [])

  const clearError = useCallback((key: keyof LoadingStates) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        error: undefined
      }
    }))
  }, [])

  const updateProgress = useCallback((key: keyof LoadingStates, progress: number) => {
    setLoadingStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        progress
      }
    }))
  }, [])

  const isLoading = useCallback((key?: keyof LoadingStates) => {
    if (key) {
      return loadingStates[key].isLoading
    }
    return Object.values(loadingStates).some(state => state.isLoading)
  }, [loadingStates])

  const hasError = useCallback((key?: keyof LoadingStates) => {
    if (key) {
      return !!loadingStates[key].error
    }
    return Object.values(loadingStates).some(state => !!state.error)
  }, [loadingStates])

  const getError = useCallback((key: keyof LoadingStates) => {
    return loadingStates[key].error
  }, [loadingStates])

  const getLoadingMessage = useCallback((key: keyof LoadingStates) => {
    return loadingStates[key].loadingMessage
  }, [loadingStates])

  const getProgress = useCallback((key: keyof LoadingStates) => {
    return loadingStates[key].progress
  }, [loadingStates])

  const reset = useCallback(() => {
    setLoadingStates({
      form: { isLoading: false },
      articles: { isLoading: false },
      boxes: { isLoading: false },
      validation: { isLoading: false },
      submission: { isLoading: false },
      printing: { isLoading: false },
      dropdowns: { isLoading: false },
      skuResolution: { isLoading: false }
    })
  }, [])

  return {
    loadingStates,
    setLoading,
    setError,
    clearError,
    updateProgress,
    isLoading,
    hasError,
    getError,
    getLoadingMessage,
    getProgress,
    reset
  }
}
