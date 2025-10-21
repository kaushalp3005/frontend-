// components/modules/inward/FormResetDialog.tsx
"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { 
  RotateCcw, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Info
} from "lucide-react"
import { FormResetOptions } from "@/lib/utils/formReset"
import { useFormReset } from "@/hooks/useFormReset"
import { Company } from "@/lib/api"
import type { InwardFormData, ArticleData, BoxData } from "@/lib/validations/inwardForm"

interface FormResetDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (options: FormResetOptions) => void
  company: Company
  formData: InwardFormData
  articles: ArticleData[]
  boxes: BoxData[]
  className?: string
}

export function FormResetDialog({
  isOpen,
  onClose,
  onConfirm,
  company,
  formData,
  articles,
  boxes,
  className
}: FormResetDialogProps) {
  const [resetOptions, setResetOptions] = useState<FormResetOptions>({
    preserveCompany: true,
    preserveTransactionNo: false,
    resetArticles: true,
    resetBoxes: true,
    resetErrors: true,
    resetWarnings: true,
    resetPrintingState: true,
    resetLastSaved: true
  })

  const { validateResetOptions, getResetSummary } = useFormReset({
    company,
    initialFormData: formData,
    initialArticles: articles,
    initialBoxes: boxes
  })

  const handleOptionChange = (option: keyof FormResetOptions, value: boolean) => {
    setResetOptions(prev => ({
      ...prev,
      [option]: value
    }))
  }

  const handleConfirm = () => {
    const validation = validateResetOptions(resetOptions)
    if (validation.isValid) {
      onConfirm(resetOptions)
      onClose()
    }
  }

  const resetSummary = getResetSummary(resetOptions)
  const validation = validateResetOptions(resetOptions)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Reset Form
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action will reset the form data. Please review the options below before confirming.
            </AlertDescription>
          </Alert>

          {/* Reset Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Reset Options</h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserveCompany"
                  checked={resetOptions.preserveCompany}
                  onCheckedChange={(checked) => handleOptionChange('preserveCompany', !!checked)}
                />
                <Label htmlFor="preserveCompany" className="text-sm">
                  Preserve Company
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserveTransactionNo"
                  checked={resetOptions.preserveTransactionNo}
                  onCheckedChange={(checked) => handleOptionChange('preserveTransactionNo', !!checked)}
                />
                <Label htmlFor="preserveTransactionNo" className="text-sm">
                  Preserve Transaction Number
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetArticles"
                  checked={resetOptions.resetArticles}
                  onCheckedChange={(checked) => handleOptionChange('resetArticles', !!checked)}
                />
                <Label htmlFor="resetArticles" className="text-sm">
                  Reset Articles ({articles.length} article(s))
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetBoxes"
                  checked={resetOptions.resetBoxes}
                  onCheckedChange={(checked) => handleOptionChange('resetBoxes', !!checked)}
                />
                <Label htmlFor="resetBoxes" className="text-sm">
                  Reset Boxes ({boxes.length} box(es))
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetErrors"
                  checked={resetOptions.resetErrors}
                  onCheckedChange={(checked) => handleOptionChange('resetErrors', !!checked)}
                />
                <Label htmlFor="resetErrors" className="text-sm">
                  Clear All Errors
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetWarnings"
                  checked={resetOptions.resetWarnings}
                  onCheckedChange={(checked) => handleOptionChange('resetWarnings', !!checked)}
                />
                <Label htmlFor="resetWarnings" className="text-sm">
                  Clear All Warnings
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetPrintingState"
                  checked={resetOptions.resetPrintingState}
                  onCheckedChange={(checked) => handleOptionChange('resetPrintingState', !!checked)}
                />
                <Label htmlFor="resetPrintingState" className="text-sm">
                  Reset Printing State
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resetLastSaved"
                  checked={resetOptions.resetLastSaved}
                  onCheckedChange={(checked) => handleOptionChange('resetLastSaved', !!checked)}
                />
                <Label htmlFor="resetLastSaved" className="text-sm">
                  Reset Last Saved Timestamp
                </Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Summary */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Reset Summary</h3>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{resetSummary}</p>
            </div>
          </div>

          {/* Validation Errors */}
          {!validation.isValid && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Validation Errors:</p>
                  <ul className="list-disc list-inside text-sm">
                    {validation.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!validation.isValid}
              className="bg-red-600 hover:bg-red-700"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Form
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
