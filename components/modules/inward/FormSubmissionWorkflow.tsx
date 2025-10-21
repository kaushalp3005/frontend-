// components/modules/inward/FormSubmissionWorkflow.tsx
"use client"

import React, { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  FileText,
  Package,
  Scale,
  DollarSign
} from "lucide-react"
import { InwardFormUtils } from "@/lib/utils/inwardFormUtils"
import { InwardFormSchema, ArticleSchema, BoxSchema } from "@/lib/validations/inwardForm"
import type { Company } from "@/types/inward"
import type { InwardFormData, ArticleData, BoxData } from "@/lib/validations/inwardForm"

interface FormSubmissionWorkflowProps {
  formData: InwardFormData
  articles: ArticleData[]
  boxes: BoxData[]
  company: Company
  isEditMode?: boolean
  originalTransactionNo?: string
  onSuccess?: (result: { success: boolean; action?: 'created' | 'updated' }) => void
  onError?: (error: string) => void
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

interface SubmissionResult {
  success: boolean
  action?: 'created' | 'updated'
  error?: string
  transactionNo?: string
}

export function FormSubmissionWorkflow({
  formData,
  articles,
  boxes,
  company,
  isEditMode = false,
  originalTransactionNo,
  onSuccess,
  onError
}: FormSubmissionWorkflowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null)
  const [currentStep, setCurrentStep] = useState<'idle' | 'validating' | 'submitting' | 'completed' | 'error'>('idle')

  const validateForm = useCallback((): ValidationResult => {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Validate main form
      InwardFormSchema.parse(formData)
    } catch (e: any) {
      if (e.errors) {
        e.errors.forEach((error: any) => {
          errors.push(`${error.path.join('.')}: ${error.message}`)
        })
      }
    }

    // Validate articles
    articles.forEach((article, index) => {
      try {
        ArticleSchema.parse(article)
      } catch (e: any) {
        if (e.errors) {
          e.errors.forEach((error: any) => {
            errors.push(`Article ${index + 1} - ${error.path.join('.')}: ${error.message}`)
          })
        }
      }

      // Additional business logic validations
      if (article.quantity_units > 0 && article.uom === 'BOX' && article.net_weight <= 0) {
        warnings.push(`Article ${index + 1}: Net weight should be greater than 0 for boxed items`)
      }

      if (article.manufacturing_date && article.expiry_date) {
        const mfgDate = new Date(article.manufacturing_date)
        const expDate = new Date(article.expiry_date)
        if (mfgDate >= expDate) {
          errors.push(`Article ${index + 1}: Manufacturing date must be before expiry date`)
        }
      }
    })

    // Validate boxes
    boxes.forEach((box, index) => {
      try {
        BoxSchema.parse(box)
      } catch (e: any) {
        if (e.errors) {
          e.errors.forEach((error: any) => {
            errors.push(`Box ${index + 1} - ${error.path.join('.')}: ${error.message}`)
          })
        }
      }

      // Additional business logic validations
      if (box.net_weight <= 0 || box.gross_weight <= 0) {
        errors.push(`Box ${index + 1}: Weight must be greater than 0`)
      }

      if (box.net_weight > box.gross_weight) {
        errors.push(`Box ${index + 1}: Net weight cannot be greater than gross weight`)
      }
    })

    // Cross-validation checks
    const totalArticleWeight = articles.reduce((sum, article) => sum + article.net_weight, 0)
    const totalBoxWeight = boxes.reduce((sum, box) => sum + box.net_weight, 0)
    
    if (Math.abs(totalArticleWeight - totalBoxWeight) > 0.01) {
      warnings.push(`Total article weight (${totalArticleWeight.toFixed(2)}kg) doesn't match total box weight (${totalBoxWeight.toFixed(2)}kg)`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }, [formData, articles, boxes])

  const handleSubmit = useCallback(async () => {
    setCurrentStep('validating')
    setValidationResult(null)
    setSubmissionResult(null)

    // Step 1: Validate form
    const validation = validateForm()
    setValidationResult(validation)

    if (!validation.isValid) {
      setCurrentStep('error')
      onError?.(`Validation failed: ${validation.errors.join(', ')}`)
      return
    }

    setCurrentStep('submitting')
    setIsSubmitting(true)

    try {
      // Step 2: Submit form
      const result = await InwardFormUtils.saveOrUpdateEntry(
        formData,
        articles,
        boxes,
        company
      )

      if (result.success) {
        setSubmissionResult({
          success: true,
          action: result.action,
          transactionNo: formData.transaction.transaction_no
        })
        setCurrentStep('completed')
        onSuccess?.(result)
      } else {
        setSubmissionResult({
          success: false,
          error: result.error
        })
        setCurrentStep('error')
        onError?.(result.error || 'Submission failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setSubmissionResult({
        success: false,
        error: errorMessage
      })
      setCurrentStep('error')
      onError?.(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, articles, boxes, company, isEditMode, originalTransactionNo, validateForm, onSuccess, onError])

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'validating':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'submitting':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getStepText = (step: string) => {
    switch (step) {
      case 'validating':
        return 'Validating form data...'
      case 'submitting':
        return 'Submitting to server...'
      case 'completed':
        return 'Submission completed successfully!'
      case 'error':
        return 'Submission failed'
      default:
        return 'Ready to submit'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStepIcon(currentStep)}
          Form Submission Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Step Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{getStepText(currentStep)}</span>
          <Badge variant={currentStep === 'completed' ? 'default' : currentStep === 'error' ? 'destructive' : 'secondary'}>
            {currentStep}
          </Badge>
        </div>

        {/* Validation Results */}
        {validationResult && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Validation Results</h4>
            
            {validationResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Errors ({validationResult.errors.length}):</p>
                    <ul className="list-disc list-inside text-sm">
                      {validationResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Warnings ({validationResult.warnings.length}):</p>
                    <ul className="list-disc list-inside text-sm">
                      {validationResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {validationResult.isValid && validationResult.warnings.length === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All validations passed successfully!
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Submission Results */}
        {submissionResult && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Submission Results</h4>
            
            {submissionResult.success ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">
                      Entry {submissionResult.action} successfully!
                    </p>
                    <p className="text-sm">
                      Transaction Number: {submissionResult.transactionNo}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-medium">Submission failed:</p>
                    <p className="text-sm">{submissionResult.error}</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Form Summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Form Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>Articles: {articles.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>Boxes: {boxes.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span>Total Weight: {boxes.reduce((sum, box) => sum + box.net_weight, 0).toFixed(2)}kg</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span>Total Amount: ₹{articles.reduce((sum: number, article: ArticleData) => sum + (article.total_amount ?? 0), 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          disabled={isSubmitting || currentStep === 'completed'}
          className="w-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {currentStep === 'validating' ? 'Validating...' : 'Submitting...'}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? 'Update Entry' : 'Create Entry'}
            </>
          )}
        </Button>

        {/* Reset Button */}
        {currentStep === 'completed' && (
          <Button 
            variant="outline" 
            onClick={() => {
              setCurrentStep('idle')
              setValidationResult(null)
              setSubmissionResult(null)
            }}
            className="w-full"
          >
            Submit Another Entry
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
