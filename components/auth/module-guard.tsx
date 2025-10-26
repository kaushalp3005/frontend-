"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore, type Module, type Action } from "@/lib/stores/auth"
import { Loader2 } from "lucide-react"

interface ModuleGuardProps {
  module: Module
  action?: Action
  children: React.ReactNode
}

/**
 * ModuleGuard - Client-side protection for module pages
 *
 * Immediately redirects to /403 if user doesn't have permission
 * Use this at the page level to protect entire modules
 *
 * @example
 * export default function InwardPage() {
 *   return (
 *     <ModuleGuard module="inward" action="view">
 *       <InwardContent />
 *     </ModuleGuard>
 *   )
 * }
 */
export function ModuleGuard({ module, action = "view", children }: ModuleGuardProps) {
  const router = useRouter()
  const { hasPermission, isLoading, isAuthenticated, currentCompanyAccess } = useAuthStore()

  useEffect(() => {
    // Wait for auth to load
    if (isLoading) return

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      console.warn('[MODULE GUARD] User not authenticated, redirecting to login')
      router.push('/login?session_expired=true')
      return
    }

    // No company access loaded yet
    if (!currentCompanyAccess) {
      console.warn('[MODULE GUARD] No company access loaded yet')
      return
    }

    // Check module permission
    const permitted = hasPermission(module, action)

    if (!permitted) {
      console.warn('[MODULE GUARD] Access denied:', { module, action })
      console.warn('[MODULE GUARD] Available modules:', currentCompanyAccess.modules.map(m => m.moduleCode))
      router.push('/403')
    }
  }, [module, action, hasPermission, isLoading, isAuthenticated, currentCompanyAccess, router])

  // Show loading state while checking permissions
  if (isLoading || !currentCompanyAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading permissions...</p>
        </div>
      </div>
    )
  }

  // Check permission
  const permitted = hasPermission(module, action)

  if (!permitted) {
    // Return null while redirecting
    return null
  }

  return <>{children}</>
}
