"use client"

import React from "react"
import { useAuthStore, type Module, type Action } from "@/lib/stores/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Lock } from "lucide-react"

interface PermissionGuardProps {
  module: Module
  action: Action
  children: React.ReactNode
  fallback?: React.ReactNode
  showError?: boolean
}

export function PermissionGuard({ 
  module, 
  action, 
  children, 
  fallback,
  showError = false 
}: PermissionGuardProps) {
  const hasPermission = useAuthStore(state => state.hasPermission)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)

  if (!isAuthenticated) {
    return null
  }

  if (!hasPermission(module, action)) {
    if (fallback) {
      return <>{fallback}</>
    }

    if (showError) {
      return (
        <Alert variant="destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to {action} {module} records.
          </AlertDescription>
        </Alert>
      )
    }

    return null
  }

  return <>{children}</>
}
// Legacy wrapper for backward compatibility
export function PermissionGate({ 
  children, 
  module, 
  fallback 
}: {
  children: React.ReactNode
  module: string
  fallback?: React.ReactNode
}) {
  return (
    <PermissionGuard module={module as Module} action="access" fallback={fallback}>
      {children}
    </PermissionGuard>
  )
}

