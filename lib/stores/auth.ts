import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Company = "CDPL" | "CFPL" | "JTC" | "HOH"
export type Role = "admin" | "ops" | "approver" | "viewer" | "developer"
export type Module = "dashboard" | "inward" | "inventory-ledger" | "transfer" | "consumption" | "reordering" | "outward" | "reports" | "settings" | "developer"
export type Action = "access" | "view" | "create" | "edit" | "delete" | "approve"

export interface User {
  id: string
  email: string
  name: string
  isDeveloper: boolean
  companies: Array<{
    code: Company
    role: Role
    name: string
  }>
}

export interface ModulePermission {
  moduleCode: Module
  moduleName: string
  permissions: {
    access: boolean
    view: boolean
    create: boolean
    edit: boolean
    delete: boolean
    approve: boolean
  }
}

export interface CompanyAccess {
  code: Company
  name: string
  role: Role
  modules: ModulePermission[]
}

interface AuthState {
  user: User | null
  currentCompany: Company | null
  currentCompanyAccess: CompanyAccess | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  
  // Actions
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  setCurrentCompany: (company: Company) => Promise<void>
  refreshPermissions: () => Promise<void>
  hasPermission: (module: Module, action: Action) => boolean
  hasCompanyAccess: (company: Company) => boolean
  isDeveloperUser: () => boolean
  
  // Static company list for dropdown
  getAvailableCompanies: () => Array<{code: Company, name: string}>
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// Static company list for dropdown
const STATIC_COMPANIES: Array<{code: Company, name: string}> = [
  { code: "CFPL", name: "CFPL Operations" },
  { code: "CDPL", name: "Candor Dates Pvt Ltd" }
]

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      currentCompany: null,
      currentCompanyAccess: null,
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,

      login: async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        set({ isLoading: true })
        
        try {
          console.log('[AUTH] Attempting login for:', email)
          
          const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          })

          if (!response.ok) {
            let errorMessage = 'Login failed. Please try again.'
            
            try {
              const errorData = await response.json()
              console.error('[AUTH] Login failed:', response.status, errorData)
              
              // Handle specific error cases
              if (response.status === 401) {
                errorMessage = 'Invalid email or password. Please check your credentials and try again.'
              } else if (response.status === 403) {
                errorMessage = 'Your account has been disabled. Please contact support.'
              } else if (response.status === 429) {
                errorMessage = 'Too many login attempts. Please try again later.'
              } else if (response.status >= 500) {
                errorMessage = 'Server error. Please try again later.'
              } else if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' 
                  ? errorData.detail 
                  : 'Login failed. Please try again.'
              } else if (errorData.message) {
                errorMessage = errorData.message
              }
            } catch (parseError) {
              console.error('[AUTH] Failed to parse error response:', parseError)
            }
            
            set({ 
              user: null,
              currentCompany: null,
              currentCompanyAccess: null,
              isAuthenticated: false,
              accessToken: null,
              isLoading: false 
            })
            
            return { success: false, error: errorMessage }
          }

          const userData = await response.json()
          console.log('[AUTH] Login response received:', userData)
          
          // Validate that we have the expected user data structure
          if (!userData.id || !userData.email) {
            console.error('[AUTH] Invalid user data structure:', userData)
            set({ isLoading: false })
            return { success: false, error: 'Invalid response from server. Please try again.' }
          }
          
          const user: User = {
            id: userData.id,
            email: userData.email,
            name: userData.name,
            isDeveloper: userData.is_developer || false,
            companies: userData.companies ? userData.companies.map((comp: any) => ({
              code: comp.code as Company,
              role: comp.role as Role,
              name: comp.name
            })) : []
          }

          console.log('[AUTH] Processed user data:', {
            id: user.id,
            email: user.email,
            name: user.name,
            isDeveloper: user.isDeveloper,
            companiesCount: user.companies.length,
            companies: user.companies
          })

          set({ 
            user, 
            isAuthenticated: true,
            accessToken: userData.access_token
          })

          // Set default company to CFPL (first in static list)
          // Will check access when user tries to access it
          const defaultCompany: Company = "CFPL"
          console.log('[AUTH] Setting default company to:', defaultCompany)
          
          set({ currentCompany: defaultCompany })
          
          // Try to fetch permissions for the default company
          try {
            await get().setCurrentCompany(defaultCompany)
          } catch (error) {
            console.warn('[AUTH] Could not access default company, user will need to select manually')
          }
          
          console.log('[AUTH] Login completed successfully')
          set({ isLoading: false })
          return { success: true }
          
        } catch (error) {
          console.error('[AUTH] Login error:', error)
          set({ 
            user: null,
            currentCompany: null,
            currentCompanyAccess: null,
            isAuthenticated: false,
            accessToken: null,
            isLoading: false 
          })
          
          // Handle network errors
          if (error instanceof TypeError && error.message.includes('fetch')) {
            return { success: false, error: 'Network error. Please check your connection and try again.' }
          }
          
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.' 
          }
        }
      },

      logout: () => {
        const { accessToken } = get()
        
        // Call logout endpoint if we have a token
        if (accessToken && !accessToken.startsWith('dev-token-')) {
          fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }).catch(console.error)
        }

        // Clear state
        set({
          user: null,
          currentCompany: null,
          currentCompanyAccess: null,
          isAuthenticated: false,
          accessToken: null,
          isLoading: false
        })
        
        // Clear persisted storage
        localStorage.removeItem('auth-storage')
        sessionStorage.clear()
      },

      setCurrentCompany: async (company: Company) => {
        console.log('[AUTH] Attempting to set current company to:', company)

        const state = get()
        const { accessToken, user } = state

        if (!user) {
          console.error('[AUTH] Cannot set company: no user')
          throw new Error('Not authenticated')
        }

        if (!accessToken) {
          console.error('[AUTH] Cannot set company: no access token')
          throw new Error('No access token')
        }

        set({ isLoading: true })

        try {
          console.log('[AUTH] Checking access and fetching dashboard info for company:', company)

          // First, check if backend server is accessible
          try {
            const healthCheck = await fetch(`${API_BASE}/health`, { 
              method: 'GET',
              headers: { 'Accept': 'application/json' }
            })
            console.log('[AUTH] Backend server health check:', healthCheck.status)
          } catch (healthError) {
            console.warn('[AUTH] Backend server health check failed:', healthError)
          }

          const response = await fetch(`${API_BASE}/auth/company/${company}/dashboard-info`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${accessToken}`,
            }
          })

          if (!response.ok) {
            if (response.status === 401) {
              // Token expired or invalid - force logout and redirect
              console.error('[AUTH] Token expired or invalid (401), logging out and redirecting')
              set({ isLoading: false })
              get().logout()
              
              // Redirect to login page with session expired flag
              if (typeof window !== 'undefined') {
                window.location.href = '/login?session_expired=true'
              }
              
              throw new Error('Session expired. Please login again.')
            }

            if (response.status === 403) {
              // User doesn't have access to this company
              set({ isLoading: false })
              throw new Error(`Access denied to ${company}. Contact your administrator for access.`)
            }

            if (response.status === 404) {
              // Company or endpoint not found - try fallback approach
              console.warn('[AUTH] Dashboard info endpoint not available, using fallback permissions')
              set({ isLoading: false })
              
              // Use fallback permissions for development
              const fallbackModules: ModulePermission[] = [
                { moduleCode: "dashboard", moduleName: "Dashboard", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "inward", moduleName: "Inward", permissions: { access: true, view: true, create: true, edit: true, delete: false, approve: false } },
                { moduleCode: "transfer", moduleName: "Transfer", permissions: { access: true, view: true, create: true, edit: true, delete: false, approve: false } },
                { moduleCode: "consumption", moduleName: "Consumption", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "inventory-ledger", moduleName: "Inventory Ledger", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "reordering", moduleName: "RTV/Rejection", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "outward", moduleName: "Outward", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "reports", moduleName: "Reports", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } },
                { moduleCode: "settings", moduleName: "Settings", permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false } }
              ]
              
              // Find company name from static list
              const staticCompany = STATIC_COMPANIES.find(c => c.code === company)
              
              const companyAccess: CompanyAccess = {
                code: company,
                name: staticCompany?.name || company,
                role: "viewer", // Default role for fallback
                modules: fallbackModules,
              }

              set({
                currentCompany: company,
                currentCompanyAccess: companyAccess,
                isLoading: false,
              })

              console.log('[AUTH] Company access set with fallback permissions for:', company)
              return // Exit early, don't throw error
            }

            if (response.status >= 500) {
              // Server error
              set({ isLoading: false })
              throw new Error(`Server error while accessing ${company}. Please try again later.`)
            }

            // Handle other HTTP errors
            const errorText = await response.text()
            console.error('[AUTH] Dashboard info API failed:', response.status, errorText)
            set({ isLoading: false })
            throw new Error(`Failed to access ${company} (HTTP ${response.status}). Please check your connection and try again.`)
          }

          const dashboardInfo = await response.json()
          console.log('[AUTH] Dashboard info response:', dashboardInfo)
          
          // Validate response structure
          if (!dashboardInfo.company || !dashboardInfo.dashboard) {
            console.error('[AUTH] Invalid dashboard info structure:', dashboardInfo)
            set({ isLoading: false })
            throw new Error('Invalid response from server')
          }

          const companyInfo = dashboardInfo.company
          const permissions = dashboardInfo.dashboard.permissions

          // Validate permissions structure
          if (!permissions || !permissions.modules || !Array.isArray(permissions.modules)) {
            console.error('[AUTH] Invalid permissions structure:', permissions)
            set({ isLoading: false })
            throw new Error('Invalid permissions data')
          }

          // Map permissions to our format
          const modules: ModulePermission[] = permissions.modules
            .filter((m: any) => m && m.module_code && m.permissions)
            .map((m: any) => ({
              moduleCode: m.module_code as Module,
              moduleName: m.module_name || m.module_code,
              permissions: {
                access: !!m.permissions.access,
                view: !!m.permissions.view,
                create: !!m.permissions.create,
                edit: !!m.permissions.edit,
                delete: !!m.permissions.delete,
                approve: !!m.permissions.approve,
              },
            }))

          // Add consumption module if not present (frontend-only module)
          const hasConsumption = modules.some(m => m.moduleCode === 'consumption')
          if (!hasConsumption) {
            modules.push({
              moduleCode: "consumption",
              moduleName: "Consumption",
              permissions: { access: true, view: true, create: false, edit: false, delete: false, approve: false }
            })
            console.log('[AUTH] Added consumption module to permissions (frontend-only)')
          }

          console.log('[AUTH] Processed modules:', modules.length, 'modules')

          // Find company name from static list
          const staticCompany = STATIC_COMPANIES.find(c => c.code === company)
          
          const companyAccess: CompanyAccess = {
            code: company,
            name: companyInfo.name || staticCompany?.name || company,
            role: companyInfo.role as Role,
            modules: modules,
          }

          set({
            currentCompany: company,
            currentCompanyAccess: companyAccess,
            isLoading: false,
          })

          console.log('[AUTH] Company access set successfully for:', company)

        } catch (error) {
          console.error('[AUTH] Failed to set current company:', error)
          set({ isLoading: false })
          
          // Handle network errors specifically
          if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error(`Network error: Unable to connect to server. Please check your internet connection and try again.`)
          }
          
          // Re-throw the error so the UI can handle it
          throw error
        }
      },

      refreshPermissions: async () => {
        const { currentCompany } = get()
        if (currentCompany) {
          console.log('[AUTH] Refreshing permissions for:', currentCompany)
          await get().setCurrentCompany(currentCompany)
        }
      },

      hasPermission: (module: Module, action: Action): boolean => {
        const { currentCompanyAccess } = get()
        
        if (!currentCompanyAccess) {
          console.warn('[AUTH] No current company access for permission check')
          return false
        }

        const modulePermission = currentCompanyAccess.modules.find(m => m.moduleCode === module)
        if (!modulePermission) {
          console.warn('[AUTH] Module not found for permission check:', module)
          return false
        }

        return modulePermission.permissions[action] || false
      },

      hasCompanyAccess: (company: Company): boolean => {
        const { user } = get()
        if (!user || !user.companies) return false

        return user.companies.some(c => c.code === company)
      },

      isDeveloperUser: (): boolean => {
        const { user } = get()
        return user?.isDeveloper || false
      },

      // Static company list for dropdown
      getAvailableCompanies: () => {
        return STATIC_COMPANIES
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        currentCompany: state.currentCompany,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken
      })
    }
  )
)