"use client"

import React, { Component, ErrorInfo, ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"

interface Props {
  children: ReactNode
  company: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class JobWorkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("JobWork page error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
              <p className="text-sm text-gray-600 mb-1 max-w-md">
                The Job Work page encountered an error. This has been logged.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <pre className="text-xs text-red-600 bg-red-100 rounded p-3 mt-2 max-w-lg overflow-auto">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" size="sm" onClick={() => window.location.href = `/${this.props.company}/transfer`}>
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Transfers
                </Button>
                <Button size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
