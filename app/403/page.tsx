"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Shield, ArrowLeft, Mail, AlertCircle } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth"

export default function ForbiddenPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, currentCompany, currentCompanyAccess } = useAuthStore()
  const [requestSent, setRequestSent] = useState(false)

  // Get context from URL params if available
  const deniedModule = searchParams?.get('module')
  const deniedAction = searchParams?.get('action')
  const deniedCompany = searchParams?.get('company')

  const handleRequestAccess = () => {
    // Prepare request details
    const requestDetails = {
      user: user?.email,
      company: deniedCompany || currentCompany,
      module: deniedModule,
      action: deniedAction,
      timestamp: new Date().toISOString()
    }

    console.log("Access request:", requestDetails)

    // TODO: Send request to backend
    // await fetch('/api/access-requests', { method: 'POST', body: JSON.stringify(requestDetails) })

    setRequestSent(true)

    // Reset after 3 seconds
    setTimeout(() => setRequestSent(false), 3000)
  }

  const handleGoBack = () => {
    // Try to go back to a safe page
    if (currentCompany) {
      router.push(`/${currentCompany}/dashboard`)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access this resource
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show details if available */}
          {(deniedModule || deniedCompany) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {deniedCompany && <div><strong>Company:</strong> {deniedCompany}</div>}
                {deniedModule && <div><strong>Module:</strong> {deniedModule}</div>}
                {deniedAction && <div><strong>Action:</strong> {deniedAction}</div>}
              </AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground text-center">
            Contact your administrator to request access to this module or company.
          </p>

          {/* Show user's current permissions */}
          {user && currentCompanyAccess && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-md">
              <p><strong>Logged in as:</strong> {user.email}</p>
              <p><strong>Current Company:</strong> {currentCompanyAccess.name}</p>
              <p><strong>Role:</strong> {currentCompanyAccess.role}</p>
            </div>
          )}

          {requestSent && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Access request logged. Please contact your administrator.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col space-y-2">
            <Button
              onClick={handleRequestAccess}
              className="w-full"
              disabled={requestSent}
            >
              <Mail className="mr-2 h-4 w-4" />
              {requestSent ? "Request Logged" : "Request Access"}
            </Button>

            <Button
              variant="outline"
              onClick={handleGoBack}
              className="w-full bg-transparent"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
