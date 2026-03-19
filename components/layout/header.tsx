"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore, type Company } from "@/lib/stores/auth"
import {
  Search,
  LogOut,
  Building2,
  ChevronDown,
  Loader2,
  Shield,
  Settings as SettingsIcon,
} from "lucide-react"

interface HeaderProps {
  company: Company
}

export function Header({ company }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [switchingCompany, setSwitchingCompany] = useState(false)

  const {
    user,
    currentCompany,
    currentCompanyAccess,
    setCurrentCompany,
    logout,
    isLoading,
    getAvailableCompanies
  } = useAuthStore()

  const router = useRouter()

  const handleCompanyChange = async (newCompany: Company) => {
    if (newCompany === currentCompany) return
    setSwitchingCompany(true)
    try {
      await setCurrentCompany(newCompany)
      router.push(`/${newCompany}/dashboard`)
    } catch (error: any) {
      console.error("[HEADER] Failed to switch company:", error)
    } finally {
      setSwitchingCompany(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Searching for:", searchQuery)
  }

  const userInitials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U"

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300"
      case "ops": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300"
      case "approver": return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300"
      case "developer": return "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300"
      default: return "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300"
    }
  }

  const getAccessibleModulesCount = () => {
    if (!currentCompanyAccess) return 0
    return currentCompanyAccess.modules.filter(m => m.permissions.access).length
  }

  const availableCompanies = getAvailableCompanies()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-3 sm:px-4 lg:px-6 gap-3">

        {/* Company Switcher */}
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0 hidden sm:block" />

          {!user ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          ) : (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger
                asChild
                disabled={isLoading || switchingCompany}
              >
                <button className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50">
                  <span className="truncate max-w-[100px] sm:max-w-[140px]">{currentCompany || "Select"}</span>
                  {(isLoading || switchingCompany) ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 z-[100]" align="start" sideOffset={5}>
                <DropdownMenuLabel>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Switch Company</span>
                    <Badge variant="outline" className="text-[10px]">
                      {availableCompanies.length} available
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {availableCompanies.map((comp) => (
                  <DropdownMenuItem
                    key={comp.code}
                    onClick={() => handleCompanyChange(comp.code)}
                    className="cursor-pointer"
                    disabled={isLoading || switchingCompany}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{comp.code}</span>
                          {comp.code === currentCompany && (
                            <Badge variant="default" className="text-[10px] h-4 px-1.5">Current</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{comp.name}</span>
                      </div>
                      {comp.code === currentCompany && currentCompanyAccess && (
                        <Badge variant="outline" className={`text-[10px] ml-2 ${getRoleColor(currentCompanyAccess.role)}`}>
                          {currentCompanyAccess.role.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xs sm:max-w-sm lg:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-input"
            />
          </div>
        </form>

        {/* Right section */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Module count */}
          {currentCompanyAccess && (
            <div className="hidden md:flex items-center gap-1 text-xs text-muted-foreground px-2">
              <Shield className="h-3.5 w-3.5" />
              <span>{getAccessibleModulesCount()} modules</span>
            </div>
          )}

          {/* Logout */}
          <Button variant="ghost" size="icon" onClick={handleLogout} className="h-9 w-9" title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>

          {/* User avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {currentCompanyAccess && (
                <>
                  <DropdownMenuItem className="cursor-default focus:bg-transparent">
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">{currentCompanyAccess.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${getRoleColor(currentCompanyAccess.role)}`}>
                        {currentCompanyAccess.role.toUpperCase()}
                      </Badge>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem onClick={() => router.push(`/${company}/settings`)}>
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span className="text-sm">Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span className="text-sm">Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
