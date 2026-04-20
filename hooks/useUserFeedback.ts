// hooks/useUserFeedback.ts
"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/hooks/use-toast"

export interface UserFeedback {
  showSuccess: (message: string, details?: string) => void
  showError: (message: string, details?: string) => void
  showWarning: (message: string, details?: string) => void
  showInfo: (message: string, details?: string) => void
  showProgress: (message: string, progress: number) => void
  hideProgress: () => void
  clearAll: () => void
}

export function useUserFeedback(): UserFeedback {
  const { toast } = useToast()
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [progressValue, setProgressValue] = useState<number>(0)

  const showSuccess = useCallback((message: string, details?: string) => {
    toast({
      title: message,
      description: details,
      variant: "default"
    })
  }, [toast])

  const showError = useCallback((message: string, details?: string) => {
    toast({
      title: message,
      description: details,
      variant: "destructive"
    })
  }, [toast])

  const showWarning = useCallback((message: string, details?: string) => {
    toast({
      title: message,
      description: details,
      variant: "default"
    })
  }, [toast])

  const showInfo = useCallback((message: string, details?: string) => {
    toast({
      title: message,
      description: details,
      variant: "default"
    })
  }, [toast])

  const showProgress = useCallback((message: string, progress: number) => {
    setProgressMessage(message)
    setProgressValue(progress)
  }, [])

  const hideProgress = useCallback(() => {
    setProgressMessage(null)
    setProgressValue(0)
  }, [])

  const clearAll = useCallback(() => {
    hideProgress()
  }, [hideProgress])

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showProgress,
    hideProgress,
    clearAll
  }
}
