// components/modules/inward/LoadingStates.tsx
"use client"

import React from "react"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { ProgressBar } from "@/components/ui/ProgressBar"
import { StatusIndicator } from "@/components/ui/StatusIndicator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { useLoadingStates } from "@/hooks/useLoadingStates"
import { useUserFeedback } from "@/hooks/useUserFeedback"

interface LoadingStatesProps {
  loadingStates: ReturnType<typeof useLoadingStates>["loadingStates"]
  className?: string
}

export function LoadingStates({ loadingStates, className }: LoadingStatesProps) {
  const { showError } = useUserFeedback()

  const getStatus = (state: any) => {
    if (state.error) return "error"
    if (state.isLoading) return "loading"
    return "idle"
  }

  const getMessage = (state: any) => {
    if (state.error) return state.error
    if (state.isLoading) return state.loadingMessage || "Loading..."
    return "Ready"
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-4">
          <h3 className="text-sm font-medium">System Status</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Form</span>
              <StatusIndicator
                status={getStatus(loadingStates.form)}
                text={getMessage(loadingStates.form)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Articles</span>
              <StatusIndicator
                status={getStatus(loadingStates.articles)}
                text={getMessage(loadingStates.articles)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Boxes</span>
              <StatusIndicator
                status={getStatus(loadingStates.boxes)}
                text={getMessage(loadingStates.boxes)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Validation</span>
              <StatusIndicator
                status={getStatus(loadingStates.validation)}
                text={getMessage(loadingStates.validation)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Submission</span>
              <StatusIndicator
                status={getStatus(loadingStates.submission)}
                text={getMessage(loadingStates.submission)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Printing</span>
              <StatusIndicator
                status={getStatus(loadingStates.printing)}
                text={getMessage(loadingStates.printing)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Dropdowns</span>
              <StatusIndicator
                status={getStatus(loadingStates.dropdowns)}
                text={getMessage(loadingStates.dropdowns)}
                size="sm"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">SKU Resolution</span>
              <StatusIndicator
                status={getStatus(loadingStates.skuResolution)}
                text={getMessage(loadingStates.skuResolution)}
                size="sm"
              />
            </div>
          </div>

          {/* Progress bars for active operations */}
          {loadingStates.submission.isLoading && loadingStates.submission.progress !== undefined && (
            <div className="mt-4">
              <ProgressBar
                value={loadingStates.submission.progress}
                showLabel
                label="Submission Progress"
                size="sm"
              />
            </div>
          )}

          {loadingStates.printing.isLoading && loadingStates.printing.progress !== undefined && (
            <div className="mt-4">
              <ProgressBar
                value={loadingStates.printing.progress}
                showLabel
                label="Printing Progress"
                size="sm"
              />
            </div>
          )}

          {/* Error alerts */}
          {Object.entries(loadingStates).map(([key, state]) => {
            if (state.error) {
              return (
                <Alert key={key} variant="destructive" className="mt-2">
                  <AlertDescription>
                    <strong>{key}:</strong> {state.error}
                  </AlertDescription>
                </Alert>
              )
            }
            return null
          })}
        </div>
      </CardContent>
    </Card>
  )
}
