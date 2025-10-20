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
    AlertTriangle
  } from "lucide-react"
  import { toast } from "@/hooks/use-toast"

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
        console.log('[HEADER] Switching to company:', newCompany)
        await setCurrentCompany(newCompany)
        
        // Success - navigate to dashboard
        router.push(`/${newCompany}/dashboard`)
        
        toast({
          title: "Company Switched",
          description: `Switched to ${newCompany} successfully`,
          variant: "default"
        })
        
      } catch (error: any) {
        console.error("[HEADER] Failed to switch company:", error)
        
        // Show error message to user
        toast({
          title: "Access Denied", 
          description: error.message || `Cannot access ${newCompany}. Contact your administrator.`,
          variant: "destructive"
        })
      } finally {
        setSwitchingCompany(false)
      }
    }

    const handleLogout = () => {
      try {
        // Show logout confirmation toast
        toast({
          title: "Logging out...",
          description: "You have been successfully logged out.",
        })
        
        // Call logout function (clears JWT token and state)
        logout()
        
        // Redirect to login page
        router.push("/login")
      } catch (error) {
        console.error('[HEADER] Logout error:', error)
        toast({
          title: "Logout Error",
          description: "There was an error logging out. Please try again.",
          variant: "destructive",
        })
      }
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
        case "admin": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        case "ops": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        case "approver": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
        case "developer": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
        case "viewer": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
        default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      }
    }

    const getAccessibleModulesCount = () => {
      if (!currentCompanyAccess) return 0
      return currentCompanyAccess.modules.filter(m => m.permissions.access).length
    }

    // Get static companies for dropdown
    const availableCompanies = getAvailableCompanies()

    // Debug logging
    console.log('[HEADER] Render state:', {
      userExists: !!user,
      userEmail: user?.email,
      currentCompany,
      isLoading,
      switchingCompany,
      availableCompaniesCount: availableCompanies.length,
      currentCompanyAccess: !!currentCompanyAccess
    })

    return (
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-12 sm:h-16 items-center px-2 sm:px-4 lg:px-6 gap-2 sm:gap-4">
          
          {/* Company Section */}
          <div className="flex items-center space-x-1 sm:space-x-2 mr-2 sm:mr-4 min-w-0">
            <Building2 className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
            
            {/* Show loading state only during initial auth */}
            {!user && (
              <div className="flex items-center space-x-2">
                <span className="font-medium text-sm">Loading...</span>
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {/* Static Company Dropdown (shown when user is authenticated) */}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger 
                  asChild
                  disabled={isLoading || switchingCompany}
                >
                  <button className="w-32 sm:w-48 h-8 sm:h-10 justify-between relative z-50 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground px-3 py-2">
                    <div className="flex items-center min-w-0">
                      <span className="truncate">{currentCompany || "Select Company"}</span>
                      {(isLoading || switchingCompany) && (
                        <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                      )}
                    </div>
                    <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="start">
                  <DropdownMenuLabel>
                    <div className="flex items-center justify-between">
                      <span>Switch Company</span>
                      <Badge variant="outline" className="text-xs">
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
                          <div className="flex items-center">
                            <span className="font-medium">{comp.code}</span>
                            {comp.code === currentCompany && (
                              <Badge variant="default" className="ml-2 text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">
                            {comp.name}
                          </span>
                        </div>
                        
                        {/* Show current role if this is the active company */}
                        {comp.code === currentCompany && currentCompanyAccess && (
                          <Badge 
                            variant="outline"
                            className={`ml-2 text-xs ${getRoleColor(currentCompanyAccess.role)}`}
                          >
                            {currentCompanyAccess.role.toUpperCase()}
                          </Badge>
                        )}
                        
                        {/* Show loading indicator for company being switched to */}
                        {switchingCompany && comp.code !== currentCompany && (
                          <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Access verified per company</span>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Global Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-sm sm:max-w-md">
            <div className="relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 h-3 w-3 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search across modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 sm:pl-10 h-8 sm:h-10 text-xs sm:text-sm"
              />
            </div>
          </form>

          {/* Status Indicators */}
          {currentCompanyAccess && (
            <div className="hidden md:flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>{getAccessibleModulesCount()} modules</span>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-1 sm:space-x-2 ml-auto">
            {/* Logout Button */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              className="h-8 w-8 sm:h-10 sm:w-10"
              title="Logout"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="sr-only">Logout</span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full">
                  <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                    <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    {user?.isDeveloper && (
                      <Badge variant="outline" className="text-xs w-fit">
                        Developer
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />
                
                {/* Current Company Info */}
                {currentCompanyAccess && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Current Access
                    </DropdownMenuLabel>
                    <DropdownMenuItem className="cursor-default">
                      <div className="flex flex-col w-full">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{currentCompanyAccess.name}</span>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getRoleColor(currentCompanyAccess.role)}`}
                          >
                            {currentCompanyAccess.role.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center mt-1 text-xs text-muted-foreground">
                          <Shield className="h-3 w-3 mr-1" />
                          <span>{getAccessibleModulesCount()} accessible modules</span>
                        </div>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Settings */}
                <DropdownMenuItem 
                  onClick={() => router.push(`/${company}/settings`)}
                  disabled={!currentCompanyAccess}
                >
                  <SettingsIcon className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">Settings</span>
                </DropdownMenuItem>

                {/* Logout */}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    )
  }