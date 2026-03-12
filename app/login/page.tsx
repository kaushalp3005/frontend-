"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Building2, AlertCircle, Info, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react"
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
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (searchParams.get('session_expired') === 'true') {
      setSessionExpired(true)
      setError("Your session has expired. Please log in again.")
    }
  }, [searchParams])

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.companies.length > 0) {
        const defaultCompany = user.companies.find(c => c.code === "CFPL") || user.companies[0]
        router.push(`/${defaultCompany.code}/dashboard`)
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
    } catch (error) {
      console.error("Login error:", error)
      setError(error instanceof Error ? error.message : "An unexpected error occurred. Please try again.")
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#f8f0f0] via-white to-[#f0e8e8]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branded panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative bg-gradient-to-br from-[#9b383d] via-[#7a2c30] to-[#5c2024] items-center justify-center p-12 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-white/5" />
        <div className="absolute top-[40%] left-[20%] w-[200px] h-[200px] rounded-full bg-white/5" />

        <div className="relative z-10 max-w-md text-white space-y-8">
          <div className="h-16 w-16 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Building2 className="h-9 w-9 text-white" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              Inventory Management System
            </h1>
            <p className="text-lg text-white/75 leading-relaxed">
              Streamline your inventory operations with real-time tracking, smart analytics, and seamless management.
            </p>
          </div>
          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 w-8 rounded-full bg-white/20 border-2 border-white/30" />
              ))}
            </div>
            <p className="text-sm text-white/60">Trusted by teams worldwide</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 md:px-12 lg:px-16 bg-gradient-to-br from-[#faf6f6] via-white to-[#f5f0f0]">
        <div className="w-full max-w-[420px] space-y-8">
          {/* Mobile logo */}
          <div className="flex flex-col items-center gap-4 lg:hidden">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* Header */}
          <div className="space-y-2 lg:space-y-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center lg:text-left">
              Welcome back
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base text-center lg:text-left">
              Enter your credentials to access your account
            </p>
          </div>

          {/* Alerts */}
          {sessionExpired && !loading && (
            <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-900">
              <Info className="h-4 w-4" />
              <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
            </Alert>
          )}

          {error && !sessionExpired && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                  required
                  className="h-12 pl-10 bg-white border-gray-200 focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="current-password"
                  required
                  className="h-12 pl-10 pr-11 bg-white border-gray-200 focus-visible:border-primary focus-visible:ring-primary/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

        </div>
      </div>
    </div>
  )
}
