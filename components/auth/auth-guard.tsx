"use client"

import React, { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, type Company, type Module } from "@/lib/stores/auth"
import { Loader2 } from "lucide-react"

interface AuthGuardProps {
  children: React.ReactNode
  company?: Company
  module?: Module
  action?: "access" | "view" | "create" | "edit" | "delete" | "approve"
  fallback?: React.ReactNode
}

export function AuthGuard({ 
  children, 
  company, 
  module, 
  action = "view",
  fallback 
}: AuthGuardProps) {
  const router = useRouter()
  const {
    user,
    isAuthenticated,
    isLoading,
    hasPermission,
    hasCompanyAccess,
    currentCompany,
    accessToken
  } = useAuthStore()

  useEffect(() => {
    // Check if user is not authenticated or has no token
    if (!isAuthenticated || !accessToken) {
      console.warn('[AUTH GUARD] User not authenticated or no access token, redirecting to login')
      router.push("/login?session_expired=true")
      return
    }

    // Check company access
    if (company && !hasCompanyAccess(company)) {
      console.warn('[AUTH GUARD] User does not have access to company:', company)
      const params = new URLSearchParams({ company })
      router.push(`/403?${params.toString()}`)
      return
    }

    // Check module/permission access if both module and action are specified
    if (module && !hasPermission(module, action)) {
      console.warn('[AUTH GUARD] User does not have permission for module:', module, 'action:', action)
      const params = new URLSearchParams({
        module,
        action,
        ...(company && { company })
      })
      router.push(`/403?${params.toString()}`)
      return
    }
  }, [company, module, action, isAuthenticated, hasCompanyAccess, hasPermission, router, accessToken])

  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )
    )
  }

  // Only render when authenticated and having correct access
  if (!isAuthenticated || !user || !accessToken) {
    return null
  }

  // Additional permission checks
  if (company && !hasCompanyAccess(company)) {
    return null
  }

  if (module && !hasPermission(module, action)) {
    return null
  }

  return <>{children}</>
}