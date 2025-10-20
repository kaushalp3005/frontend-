// File: app/login/page.tsx
// Location: frontend/src/app/login/page.tsx
// Status: REPLACE EXISTING FILE

"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Building2, AlertCircle, Info } from "lucide-react"
import { useAuthStore } from "@/lib/stores/auth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, isAuthenticated, user, isLoading } = useAuthStore()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    // Check if session expired
    if (searchParams.get('session_expired') === 'true') {
      setSessionExpired(true)
      setError("Your session has expired. Please log in again.")
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.companies.length > 0) {
        router.push(`/${user.companies[0].code}/dashboard`)
      } else {
        router.push("/403")
      }
    }
  }, [isAuthenticated, user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }

    setLoading(true)
    setError("")
    setSessionExpired(false)

    try {
      const result = await login(email, password)
      
      if (!result.success) {
        setError(result.error || "Login failed. Please try again.")
        setLoading(false)
      }
      // On success, the useEffect will handle the redirect
    } catch (error) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader className="space-y-1 px-4 py-6">
            <div className="flex items-center justify-center mb-4">
              <Building2 className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
            </div>
            <CardTitle className="text-xl sm:text-2xl text-center">Sign in</CardTitle>
            <CardDescription className="text-center text-sm">
              Enter your credentials to access the inventory management system
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {sessionExpired && !loading && (
                <Alert variant="default" className="border-amber-500 bg-amber-50 text-amber-900">
                  <Info className="h-4 w-4" />
                  <AlertDescription>Your session has expired. Please log in again to continue.</AlertDescription>
                </Alert>
              )}
              
              {error && !sessionExpired && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                  className="h-11"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-11" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
            
            <div className="mt-6 text-center text-xs text-muted-foreground space-y-1">
              <p>Default admin credentials:</p>
              <p className="break-all">admin@company.com</p>
              <p>Password: admin123</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
