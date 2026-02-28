// File: ConsumptionErrorBoundary.tsx
// Path: frontend/src/components/modules/consumption/ConsumptionErrorBoundary.tsx

"use client"

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface ConsumptionErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ConsumptionErrorBoundaryProps {
  children: React.ReactNode
}

export class ConsumptionErrorBoundary extends React.Component<
  ConsumptionErrorBoundaryProps,
  ConsumptionErrorBoundaryState
> {
  constructor(props: ConsumptionErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ConsumptionErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Consumption module error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle>Consumption Module Error</CardTitle>
              </div>
              <CardDescription>
                Something went wrong while loading the consumption module
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-sm text-destructive">
                  <strong>Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={this.handleRetry} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline"
                >
                  Reload Page
                </Button>
              </div>
              
              <div className="text-xs text-muted-foreground">
                <p>If the problem persists, please:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Check your internet connection</li>
                  <li>Refresh the page</li>
                  <li>Contact support if the issue continues</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
