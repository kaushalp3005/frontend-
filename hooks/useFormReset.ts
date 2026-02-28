// hooks/useFormReset.ts
"use client"

import { useState, useCallback } from "react"
import { FormResetUtils, FormResetOptions, FormResetResult } from "@/lib/utils/formReset"
import { Company } from "@/lib/api"
import type { InwardFormData, ArticleData, BoxData } from "@/lib/validations/inwardForm"

export interface UseFormResetProps {
  company: Company
  initialFormData: InwardFormData
  initialArticles: ArticleData[]
  initialBoxes: BoxData[]
}

export interface UseFormResetReturn {
  // Reset functions
  resetForm: (options?: FormResetOptions) => FormResetResult
  resetField: (fieldName: string, currentValue: any) => { success: boolean; newValue: any; message: string }
  resetArticle: (articleId: string, currentArticle: ArticleData) => { success: boolean; newArticle: ArticleData; message: string }
  resetBox: (boxId: string, currentBox: BoxData) => { success: boolean; newBox: BoxData; message: string }
  resetErrors: () => { success: boolean; message: string }
  resetWarnings: () => { success: boolean; message: string }
  resetPrintingState: () => { success: boolean; message: string }
  resetLastSaved: () => { success: boolean; message: string }
  
  // Utility functions
  validateResetOptions: (options: FormResetOptions) => { isValid: boolean; errors: string[] }
  getResetSummary: (options: FormResetOptions) => string
  
  // State
  isResetting: boolean
  resetHistory: FormResetResult[]
  lastReset: FormResetResult | null
}

export function useFormReset({
  company,
  initialFormData,
  initialArticles,
  initialBoxes
}: UseFormResetProps): UseFormResetReturn {
  const [isResetting, setIsResetting] = useState(false)
  const [resetHistory, setResetHistory] = useState<FormResetResult[]>([])
  const [lastReset, setLastReset] = useState<FormResetResult | null>(null)

  const resetForm = useCallback((options: FormResetOptions = {}) => {
    setIsResetting(true)
    
    try {
      const result = FormResetUtils.resetForm(
        initialFormData,
        initialArticles,
        initialBoxes,
        options
      )
      
      setResetHistory(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 resets
      setLastReset(result)
      
      return result
    } finally {
      setIsResetting(false)
    }
  }, [company, initialFormData, initialArticles, initialBoxes])

  const resetField = useCallback((fieldName: string, currentValue: any) => {
    return FormResetUtils.resetField(fieldName, currentValue, company)
  }, [company])

  const resetArticle = useCallback((articleId: string, currentArticle: ArticleData) => {
    return FormResetUtils.resetArticle(articleId, currentArticle)
  }, [])

  const resetBox = useCallback((boxId: string, currentBox: BoxData) => {
    return FormResetUtils.resetBox(boxId, currentBox)
  }, [])

  const resetErrors = useCallback(() => {
    return FormResetUtils.resetErrors()
  }, [])

  const resetWarnings = useCallback(() => {
    return FormResetUtils.resetWarnings()
  }, [])

  const resetPrintingState = useCallback(() => {
    return FormResetUtils.resetPrintingState()
  }, [])

  const resetLastSaved = useCallback(() => {
    return FormResetUtils.resetLastSaved()
  }, [])

  const validateResetOptions = useCallback((options: FormResetOptions) => {
    return FormResetUtils.validateResetOptions(options)
  }, [])

  const getResetSummary = useCallback((options: FormResetOptions) => {
    return FormResetUtils.getResetSummary(
      initialFormData,
      initialArticles,
      initialBoxes,
      options
    )
  }, [initialFormData, initialArticles, initialBoxes])

  return {
    resetForm,
    resetField,
    resetArticle,
    resetBox,
    resetErrors,
    resetWarnings,
    resetPrintingState,
    resetLastSaved,
    validateResetOptions,
    getResetSummary,
    isResetting,
    resetHistory,
    lastReset
  }
}
