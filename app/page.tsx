"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/stores/auth"

export default function HomePage() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()
  const [hasRedirected, setHasRedirected] = useState(false)

  useEffect(() => {
    // Only redirect once and allow enough time for store population
    if (!hasRedirected) {
      const timer = setTimeout(() => {
        if (isAuthenticated && user && user.companies) {
          if (user.companies.length > 0) {
            // Sort companies by role priority and redirect to highest priority company
            const rolePriority: Record<string, number> = {
              developer: 6,
              admin: 5,
              ops: 4,
              approver: 3,
              viewer: 2
            }
            
            const sortedCompanies = [...user.companies].sort((a, b) => {
              const roleDiff = (rolePriority[b.role] || 0) - (rolePriority[a.role] || 0)
              if (roleDiff !== 0) return roleDiff
              return a.code.localeCompare(b.code)
            })
            
            router.push(`/${sortedCompanies[0].code}/dashboard`)
          } else {
            router.push("/403")
          }
        } else {
          router.push("/login")
        }
        setHasRedirected(true)
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [user, isAuthenticated, router, hasRedirected])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-3 sm:mb-4">Inventory Management System</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  )
}
